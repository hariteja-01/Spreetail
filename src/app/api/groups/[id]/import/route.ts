import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { calculateSplits } from '@/lib/balanceCalculator';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { expenses, anomalies } = await request.json();
    const groupId = params.id;

    // Verify group exists and user is admin/member
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { members: { include: { user: true } } }
    });
    if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

    const usersData = group.members.map(m => ({ id: m.userId, name: m.user.name }));

    // Run in a transaction
    await prisma.$transaction(async (tx) => {
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
          const payer = usersData.find(u => u.name.toLowerCase() === exp.paidByStr.toLowerCase());
          const payeeNameStr = exp.splitWithStr[0] || 'Unknown';
          let payee = usersData.find(u => u.name.toLowerCase() === payeeNameStr.toLowerCase());
          
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
        const payer = usersData.find(u => u.name.toLowerCase() === exp.paidByStr.toLowerCase());
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
