import { getSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    include: {
      memberships: {
        include: {
          group: true
        }
      }
    }
  });

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Welcome, {session.name}</h1>
        <form action="/api/auth/logout" method="POST">
          <Button variant="outline" type="submit">Logout</Button>
        </form>
      </div>

      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-slate-200">Your Groups</h2>
          <Link href="/groups/new">
            <Button className="bg-teal-600 hover:bg-teal-500 text-white shadow-lg shadow-teal-500/20 transition-all">Create New Group</Button>
          </Link>
        </div>

        {user?.memberships.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            You aren't part of any groups yet. Create one to get started!
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {user?.memberships.map((m) => (
              <Link key={m.groupId} href={`/groups/${m.groupId}`}>
                <div className="p-5 border border-white/10 bg-white/5 rounded-xl hover:bg-white/10 hover:border-teal-500/50 hover:shadow-[0_0_20px_rgba(20,184,166,0.15)] transition-all cursor-pointer group">
                  <h3 className="font-semibold text-lg text-slate-200 group-hover:text-teal-400 transition-colors">{m.group.name}</h3>
                  <p className="text-sm text-slate-400 mt-2">Joined: {new Date(m.joinedAt).toLocaleDateString()}</p>
                  {m.leftAt && <p className="text-sm text-red-400 mt-1">Left: {new Date(m.leftAt).toLocaleDateString()}</p>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
