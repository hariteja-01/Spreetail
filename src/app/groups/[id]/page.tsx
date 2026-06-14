import { getSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default async function GroupDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const group = await prisma.group.findUnique({
    where: { id: params.id },
    include: {
      members: { include: { user: true } },
      expenses: {
        orderBy: { date: 'desc' },
        include: { paidBy: true, splits: { include: { user: true } } }
      },
      payments: {
        orderBy: { date: 'desc' },
        include: { payer: true, payee: true }
      },
      anomalies: {
        orderBy: { rowNumber: 'asc' }
      }
    }
  });

  if (!group) return <div>Group not found</div>;

  // Verify membership
  if (!group.members.some(m => m.userId === session.id)) {
    return <div>Not a member of this group</div>;
  }

  // Calculate overall balances
  // Using exact pairwise matching like the DECISIONS.md says.
  const balances: Record<string, Record<string, number>> = {};
  group.members.forEach(m => {
    balances[m.userId] = {};
    group.members.forEach(m2 => {
      if (m.userId !== m2.userId) balances[m.userId][m2.userId] = 0;
    });
  });

  // 1. Add Debts from Expenses
  group.expenses.forEach(exp => {
    exp.splits.forEach(split => {
      if (split.userId !== exp.paidById) {
        balances[split.userId][exp.paidById] += split.amount; // user owes payer
      }
    });
  });

  // 2. Subtract Payments (Settlements)
  group.payments.forEach(payment => {
    balances[payment.payerId][payment.payeeId] -= payment.amount; // payer paid payee, reducing debt
  });

  // 3. Simplify Net Pairwise (A owes B 500, B owes A 200 => A owes B 300)
  const netBalances: { from: string, to: string, amount: number, fromName: string, toName: string }[] = [];
  
  const userMap = new Map(group.members.map(m => [m.userId, m.user.name]));

  const processedPairs = new Set<string>();
  group.members.forEach(m1 => {
    group.members.forEach(m2 => {
      if (m1.userId === m2.userId) return;
      const pairKey = [m1.userId, m2.userId].sort().join('-');
      if (processedPairs.has(pairKey)) return;
      processedPairs.add(pairKey);

      const m1OwesM2 = balances[m1.userId][m2.userId];
      const m2OwesM1 = balances[m2.userId][m1.userId];
      const net = m1OwesM2 - m2OwesM1;

      if (net > 0) {
        netBalances.push({
          from: m1.userId, to: m2.userId, amount: net,
          fromName: userMap.get(m1.userId)!, toName: userMap.get(m2.userId)!
        });
      } else if (net < 0) {
        netBalances.push({
          from: m2.userId, to: m1.userId, amount: Math.abs(net),
          fromName: userMap.get(m2.userId)!, toName: userMap.get(m1.userId)!
        });
      }
    });
  });

  // User specific balances
  const myOwes = netBalances.filter(b => b.from === session.id);
  const owedToMe = netBalances.filter(b => b.to === session.id);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{group.name}</h1>
          <p className="text-gray-500">Base Currency: {group.currency}</p>
        </div>
        <div className="flex gap-4">
          <Link href="/dashboard"><Button variant="outline">Dashboard</Button></Link>
          <Link href={`/groups/${group.id}/import`}><Button>Import CSV</Button></Link>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        
        {/* Balances Column */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-md border">
            <h2 className="text-xl font-semibold mb-4">Your Balances</h2>
            {myOwes.length === 0 && owedToMe.length === 0 && (
              <p className="text-gray-500">You are completely settled up!</p>
            )}
            
            {myOwes.length > 0 && (
              <div className="mb-4">
                <h3 className="font-medium text-red-600 mb-2">You Owe:</h3>
                <ul className="space-y-2">
                  {myOwes.map((b, i) => (
                    <li key={i} className="flex justify-between text-sm border-b pb-1">
                      <span>{b.toName}</span>
                      <span className="font-semibold text-red-600">{b.amount.toFixed(2)} {group.currency}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {owedToMe.length > 0 && (
              <div>
                <h3 className="font-medium text-green-600 mb-2">You are Owed:</h3>
                <ul className="space-y-2">
                  {owedToMe.map((b, i) => (
                    <li key={i} className="flex justify-between text-sm border-b pb-1">
                      <span>{b.fromName}</span>
                      <span className="font-semibold text-green-600">{b.amount.toFixed(2)} {group.currency}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-xl shadow-md border">
            <h2 className="text-xl font-semibold mb-4">Members</h2>
            <ul className="space-y-3">
              {group.members.map(m => (
                <li key={m.id} className="text-sm">
                  <div className="font-medium">{m.user.name} {m.userId === session.id && '(You)'}</div>
                  <div className="text-xs text-gray-500">
                    Joined: {new Date(m.joinedAt).toLocaleDateString()}
                    {m.leftAt && <span className="text-red-500"> | Left: {new Date(m.leftAt).toLocaleDateString()}</span>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Expenses Column */}
        <div className="md:col-span-2 space-y-6">
          
          {group.anomalies.length > 0 && (
            <div className="bg-blue-50 border-blue-200 border p-6 rounded-xl">
              <h2 className="text-lg font-semibold text-blue-800 mb-2">Import Report Summary</h2>
              <div className="max-h-40 overflow-y-auto space-y-2 text-sm text-blue-900">
                {group.anomalies.map(anom => (
                  <div key={anom.id} className="bg-white p-2 rounded">
                    <strong>Row {anom.rowNumber}:</strong> {anom.issueType} <br/>
                    <span className="text-gray-600">Resolution: {anom.resolution}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white p-6 rounded-xl shadow-md border">
            <h2 className="text-xl font-semibold mb-4">Recent Expenses</h2>
            {group.expenses.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No expenses yet. Import your CSV to get started.</p>
            ) : (
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                {group.expenses.map(exp => (
                  <div key={exp.id} className="border p-4 rounded-lg flex justify-between items-start">
                    <div>
                      <div className="font-semibold text-lg">{exp.description}</div>
                      <div className="text-sm text-gray-500">{new Date(exp.date).toLocaleDateString()} • Paid by {exp.paidBy.name}</div>
                      <div className="text-xs text-gray-400 mt-1">Split Type: {exp.splitType}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg">{exp.amount} {exp.currency}</div>
                      {exp.currency !== group.currency && (
                        <div className="text-xs text-orange-500">
                          (Converted to {group.currency} internally)
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
