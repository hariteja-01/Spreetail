import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

const USD_RATE = 83;

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { expenses, anomalies } = await request.json();
    const params = await props.params;
    const groupId = params.id;

    // Verify group exists and user is admin/member
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { members: { include: { user: true } } }
    });
    if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

    // Build a mutable list of known users
    const knownUsers: { id: string; name: string }[] = group.members.map((m: any) => ({
      id: m.userId,
      name: m.user.name,
    }));

    // Build a mutable list of member records (for temporal checks)
    const memberRecords: { userId: string; joinedAt: Date; leftAt: Date | null }[] = group.members.map((m: any) => ({
      userId: m.userId,
      joinedAt: new Date(m.joinedAt),
      leftAt: m.leftAt ? new Date(m.leftAt) : null,
    }));

    // Run in a transaction with a generous timeout
    await prisma.$transaction(async (tx: any) => {

      // ── Step 1: Auto-create missing participants ──
      const allNames = new Set<string>();
      for (const e of expenses) {
        if (e.paidByStr && e.paidByStr.trim()) allNames.add(e.paidByStr.trim());
        if (Array.isArray(e.splitWithStr)) {
          for (const s of e.splitWithStr) {
            if (s && s.trim()) allNames.add(s.trim());
          }
        }
      }

      for (const pName of Array.from(allNames)) {
        const alreadyKnown = knownUsers.find(u => u.name.toLowerCase() === pName.toLowerCase());
        if (alreadyKnown) continue;

        // Find or create the User record
        let dbUser = await tx.user.findFirst({
          where: { name: { equals: pName, mode: 'insensitive' } },
        });
        if (!dbUser) {
          const safeName = pName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'unknown';
          const uid = Math.random().toString(36).substring(2, 8);
          dbUser = await tx.user.create({
            data: {
              name: pName,
              email: `${safeName}_${uid}@guest.local`,
              password: 'not_a_real_account',
            },
          });
        }

        // Check if already a member of this group (unique constraint)
        const existingMembership = await tx.groupMember.findUnique({
          where: { userId_groupId: { userId: dbUser.id, groupId } },
        });

        if (!existingMembership) {
          await tx.groupMember.create({
            data: {
              groupId,
              userId: dbUser.id,
              joinedAt: new Date('2026-01-01'),
            },
          });
        }

        knownUsers.push({ id: dbUser.id, name: dbUser.name });
        memberRecords.push({
          userId: dbUser.id,
          joinedAt: new Date('2026-01-01'),
          leftAt: null,
        });
      }

      // ── Step 2: Save anomalies in bulk ──
      if (anomalies && anomalies.length > 0) {
        await tx.importAnomaly.createMany({
          data: anomalies.map((a: any) => ({
            groupId,
            rowNumber: a.rowNumber ?? 0,
            issueType: a.issueType ?? 'Unknown',
            resolution: a.resolution ?? '',
          })),
        });
      }

      // ── Step 3: Process each expense row ──
      for (const exp of expenses) {
        // Parse the date safely (it arrives as an ISO string from the client)
        const expDate = new Date(exp.date);
        if (isNaN(expDate.getTime())) continue; // Skip rows with bad dates

        // ── Settlements / Payments ──
        if (exp.isSettlement) {
          const payer = knownUsers.find(u => u.name.toLowerCase() === (exp.paidByStr || '').toLowerCase());
          const payeeName = (exp.splitWithStr && exp.splitWithStr[0]) || '';
          const payee = knownUsers.find(u => u.name.toLowerCase() === payeeName.toLowerCase());

          if (payer && payee) {
            await tx.payment.create({
              data: {
                groupId,
                payerId: payer.id,
                payeeId: payee.id,
                amount: exp.amount,
                date: expDate,
              },
            });
          }
          continue;
        }

        // ── Regular Expense ──
        const payer = knownUsers.find(u => u.name.toLowerCase() === (exp.paidByStr || '').toLowerCase());
        if (!payer) continue;

        // Convert currency
        let baseAmount = exp.amount;
        if ((exp.currency || '').toUpperCase() === 'USD') {
          baseAmount = exp.amount * USD_RATE;
        }

        // Determine who this is split with (only active members at the time)
        const splitNames: string[] = (exp.splitWithStr || []).map((s: string) => s.toLowerCase());
        const eligibleUsers: { id: string; name: string }[] = [];

        for (const sName of splitNames) {
          if (!sName.trim()) continue;
          const user = knownUsers.find(u => u.name.toLowerCase() === sName);
          if (!user) continue;

          // Temporal check: was this member active on the expense date?
          const membership = memberRecords.find(m => m.userId === user.id);
          if (membership) {
            const joinedTime = membership.joinedAt.getTime();
            const leftTime = membership.leftAt ? membership.leftAt.getTime() : null;
            const expTime = expDate.getTime();

            if (expTime >= joinedTime && (leftTime === null || expTime <= leftTime)) {
              eligibleUsers.push(user);
            }
          }
        }

        if (eligibleUsers.length === 0) continue;

        // ── Calculate each person's split amount ──
        const N = eligibleUsers.length;
        const splitAmounts: { userId: string; amount: number }[] = [];

        if (exp.isRefund) {
          // Refund: payer received money back, each participant's debt decreases
          const share = baseAmount / N;
          for (const u of eligibleUsers) {
            splitAmounts.push({
              userId: u.id,
              amount: u.id === payer.id ? 0 : -share,
            });
          }
        } else {
          switch (exp.splitType) {
            case 'PERCENTAGE': {
              const pctMap = new Map<string, number>();
              let totalPct = 0;
              if (exp.splitDetailsStr) {
                for (const part of exp.splitDetailsStr.split(';')) {
                  const match = part.trim().match(/([a-zA-Z\s]+)\s*(\d+)%/);
                  if (match) {
                    const name = match[1].trim().toLowerCase();
                    const pct = parseInt(match[2], 10);
                    const u = eligibleUsers.find(eu => eu.name.toLowerCase() === name);
                    if (u) { pctMap.set(u.id, pct); totalPct += pct; }
                  }
                }
              }
              for (const u of eligibleUsers) {
                let pct = pctMap.get(u.id) || 0;
                pct = totalPct > 0 ? (pct / totalPct) * 100 : (100 / N);
                const share = Math.round((baseAmount * pct / 100) * 100) / 100;
                splitAmounts.push({ userId: u.id, amount: u.id === payer.id ? share - baseAmount : share });
              }
              break;
            }
            case 'SHARES': {
              const shareMap = new Map<string, number>();
              let totalShares = 0;
              if (exp.splitDetailsStr) {
                for (const part of exp.splitDetailsStr.split(';')) {
                  const match = part.trim().match(/([a-zA-Z\s]+)\s+(\d+)/);
                  if (match) {
                    const name = match[1].trim().toLowerCase();
                    const s = parseInt(match[2], 10);
                    const u = eligibleUsers.find(eu => eu.name.toLowerCase() === name);
                    if (u) { shareMap.set(u.id, s); totalShares += s; }
                  }
                }
              }
              for (const u of eligibleUsers) {
                const s = shareMap.get(u.id) || (totalShares === 0 ? 1 : 0);
                const t = totalShares === 0 ? N : totalShares;
                const share = Math.round((baseAmount * (s / t)) * 100) / 100;
                splitAmounts.push({ userId: u.id, amount: u.id === payer.id ? share - baseAmount : share });
              }
              break;
            }
            case 'EXACT': {
              const exactMap = new Map<string, number>();
              if (exp.splitDetailsStr) {
                for (const part of exp.splitDetailsStr.split(';')) {
                  const match = part.trim().match(/([a-zA-Z\s]+)\s+([\d.]+)/);
                  if (match) {
                    const name = match[1].trim().toLowerCase();
                    const amt = parseFloat(match[2]);
                    const u = eligibleUsers.find(eu => eu.name.toLowerCase() === name);
                    if (u) exactMap.set(u.id, amt);
                  }
                }
              }
              for (const u of eligibleUsers) {
                const share = exactMap.get(u.id) || 0;
                splitAmounts.push({ userId: u.id, amount: u.id === payer.id ? share - baseAmount : share });
              }
              break;
            }
            default: {
              // EQUAL split
              const share = Math.round((baseAmount / N) * 100) / 100;
              for (const u of eligibleUsers) {
                splitAmounts.push({ userId: u.id, amount: u.id === payer.id ? share - baseAmount : share });
              }
              break;
            }
          }
        }

        // Create expense + splits together
        await tx.expense.create({
          data: {
            groupId,
            description: exp.description || 'Untitled',
            amount: exp.amount,
            currency: exp.currency || 'INR',
            date: expDate,
            paidById: payer.id,
            splitType: exp.splitType || 'EQUAL',
            splits: {
              create: splitAmounts.map(sa => ({
                userId: sa.userId,
                amount: sa.amount,
              })),
            },
          },
        });
      }
    }, { timeout: 30000 }); // 30s timeout for the transaction

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Import error:', error?.message || error);
    return NextResponse.json(
      { error: `Import failed: ${error?.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
}
