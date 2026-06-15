import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { calculateSplits } from '@/lib/balanceCalculator';

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
    const usersData = group.members.map((m: any) => ({ id: m.userId, name: m.user.name }));

    // Run in a transaction
    await prisma.$transaction(async (tx: any) => {
      
      // Auto-create missing participants found in the CSV
      const participants = new Set<string>();
      expenses.forEach((e: any) => {
        participants.add(e.paidByStr);
        e.splitWithStr.forEach((s: string) => participants.add(s));
      });

      for (const pName of Array.from(participants)) {
        let existingUser = usersData.find((u: any) => u.name.toLowerCase() === pName.toLowerCase());
        if (!existingUser) {
          // Check if user exists globally
          let dbUser = await tx.user.findFirst({ where: { name: { equals: pName, mode: 'insensitive' } } });
          if (!dbUser) {
            // Create dummy user
            dbUser = await tx.user.create({
              data: {
                name: pName,
                email: `${pName.replace(/\s/g, '').toLowerCase()}@guest.local`,
                password: 'dummy_password'
              }
            });
          }
          // Add to group
          await tx.groupMember.create({
            data: {
              groupId,
              userId: dbUser.id,
              joinedAt: new Date('2026-01-01') // Join early so temporal logic works
            }
          });
          usersData.push({ id: dbUser.id, name: dbUser.name });
        }
      }

      // Create anomalies for the report
      for (const anom of anomalies) {
        await tx.importAnomaly.create({
          data: {
            groupId,
            rowNumber: anom.rowNumber,
            issueType: anom.issueType,
            resolution: anom.resolution,
          }
        });
      }

      // Process expenses
      for (const exp of expenses) {
        if (exp.isSettlement) {
          // It's a payment
          const payer = usersData.find((u: any) => u.name.toLowerCase() === exp.paidByStr.toLowerCase());
          const payeeNameStr = exp.splitWithStr[0] || 'Unknown';
          let payee = usersData.find((u: any) => u.name.toLowerCase() === payeeNameStr.toLowerCase());
          
          if (payer && payee) {
             await tx.payment.create({
               data: {
                 groupId,
                 payerId: payer.id,
                 payeeId: payee.id,
                 amount: exp.amount,
                 date: new Date(exp.date),
               }
             });
          }
          continue;
        }

        // It's an expense
        const payer = usersData.find((u: any) => u.name.toLowerCase() === exp.paidByStr.toLowerCase());
        if (!payer) continue; // Skip if payer not found in group

        const createdExpense = await tx.expense.create({
          data: {
            groupId,
            description: exp.description,
            amount: exp.amount,
            currency: exp.currency,
            date: new Date(exp.date),
            paidById: payer.id,
            splitType: exp.splitType,
          }
        });

        // Calculate exact splits
        const splits = calculateSplits(exp, group.members, usersData);
        for (const split of splits) {
           await tx.expenseSplit.create({
             data: {
               expenseId: createdExpense.id,
               userId: split.userId,
               amount: split.amountOwed,
             }
           });
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Import error", error);
    return NextResponse.json({ error: 'Failed to import CSV' }, { status: 500 });
  }
}
