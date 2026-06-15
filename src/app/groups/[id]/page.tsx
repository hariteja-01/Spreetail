import { getSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { DeleteGroupButton } from '@/components/DeleteGroupButton';
import { AddMemberForm } from '@/components/AddMemberForm';

export default async function GroupDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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
  
  const userMap = new Map<string, string>(group.members.map((m: any) => [m.userId, m.user.name]));

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
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-sky-400 tracking-tight">{group.name}</h1>
          <p className="text-slate-400 mt-2 font-medium">Base Currency: <span className="text-teal-400">{group.currency}</span></p>
        </div>
        <div className="flex gap-4">
          <Link href="/dashboard"><Button variant="outline" className="border-white/20 hover:bg-white/10 rounded-full px-6 py-2">Dashboard</Button></Link>
          <Link href={`/groups/${group.id}/import`}><Button className="bg-teal-600 hover:bg-teal-500 rounded-full px-6 py-2">Import CSV</Button></Link>
          <DeleteGroupButton groupId={group.id} />
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        
        {/* Balances Column */}
        <div className="space-y-6">
          <div className="bg-white/5 backdrop-blur-xl p-6 rounded-2xl shadow-2xl border border-white/10">
            <h2 className="text-xl font-semibold mb-4 text-slate-100">Your Balances</h2>
            {myOwes.length === 0 && owedToMe.length === 0 && (
              <p className="text-slate-400 text-sm">You are completely settled up!</p>
            )}
            
            {myOwes.length > 0 && (
              <div className="mb-5">
                <h3 className="font-medium text-red-400 mb-3 text-sm uppercase tracking-wider">You Owe</h3>
                <ul className="space-y-3">
                  {myOwes.map((b, i) => (
                    <li key={i} className="flex justify-between text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                      <span className="text-slate-200">{b.toName}</span>
                      <span className="font-bold text-red-400">{b.amount.toFixed(2)} {group.currency}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {owedToMe.length > 0 && (
              <div>
                <h3 className="font-medium text-teal-400 mb-3 text-sm uppercase tracking-wider">You are Owed</h3>
                <ul className="space-y-3">
                  {owedToMe.map((b, i) => (
                    <li key={i} className="flex justify-between text-sm bg-teal-500/10 p-3 rounded-lg border border-teal-500/20">
                      <span className="text-slate-200">{b.fromName}</span>
                      <span className="font-bold text-teal-400">{b.amount.toFixed(2)} {group.currency}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="bg-white/5 backdrop-blur-xl p-6 rounded-2xl shadow-2xl border border-white/10">
            <h2 className="text-xl font-semibold mb-4 text-slate-100">Members</h2>
            <ul className="space-y-4">
              {group.members.map(m => (
                <li key={m.id} className="text-sm flex flex-col gap-1">
                  <div className="font-medium text-slate-200">{m.user.name} {m.userId === session.id && <span className="text-teal-400 text-xs ml-1 bg-teal-500/10 px-2 py-0.5 rounded-full">You</span>}</div>
                  <div className="text-xs text-slate-500">
                    Joined: {new Date(m.joinedAt).toLocaleDateString()}
                    {m.leftAt && <span className="text-red-400"> | Left: {new Date(m.leftAt).toLocaleDateString()}</span>}
                  </div>
                </li>
              ))}
            </ul>
            <AddMemberForm groupId={group.id} />
          </div>
        </div>

        {/* Expenses Column */}
        <div className="md:col-span-2 space-y-6">
          
          {group.anomalies.length > 0 && (
            <div className="bg-sky-900/20 backdrop-blur-md border-sky-500/30 border p-6 rounded-2xl shadow-lg">
              <h2 className="text-lg font-semibold text-sky-300 mb-3 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                Import Report Summary
              </h2>
              <div className="max-h-48 overflow-y-auto space-y-3 text-sm text-sky-100 pr-2 custom-scrollbar">
                {group.anomalies.map(anom => (
                  <div key={anom.id} className="bg-white/5 border border-white/10 p-3 rounded-xl">
                    <strong className="text-sky-300">Row {anom.rowNumber}:</strong> {anom.issueType} <br/>
                    <span className="text-sky-200/70 text-xs mt-1 block">Resolution: {anom.resolution}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white/5 backdrop-blur-xl p-6 rounded-2xl shadow-2xl border border-white/10">
            <h2 className="text-xl font-semibold mb-6 text-slate-100">Recent Expenses</h2>
            {group.expenses.length === 0 ? (
              <p className="text-slate-500 text-center py-12">No expenses yet. Import your CSV to get started.</p>
            ) : (
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {group.expenses.map(exp => (
                  <div key={exp.id} className="border border-white/10 bg-white/5 p-5 rounded-xl flex justify-between items-start hover:bg-white/10 hover:border-teal-500/30 transition-all group/exp">
                    <div>
                      <div className="font-semibold text-lg text-slate-200 group-hover/exp:text-teal-300 transition-colors">{exp.description}</div>
                      <div className="text-sm text-slate-400 mt-1">{new Date(exp.date).toLocaleDateString()} • Paid by <span className="text-slate-300 font-medium">{exp.paidBy.name}</span></div>
                      <div className="text-xs font-mono text-teal-500/70 mt-2 bg-teal-500/10 inline-block px-2 py-0.5 rounded">SPLIT: {exp.splitType}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-xl text-slate-100">{exp.amount} <span className="text-sm font-normal text-slate-400">{exp.currency}</span></div>
                      {exp.currency !== group.currency && (
                        <div className="text-xs text-amber-400/80 mt-1">
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
