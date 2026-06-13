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

      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Your Groups</h2>
          <Link href="/groups/new">
            <Button>Create New Group</Button>
          </Link>
        </div>

        {user?.memberships.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            You aren't part of any groups yet. Create one to get started!
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {user?.memberships.map((m) => (
              <Link key={m.groupId} href={`/groups/${m.groupId}`}>
                <div className="p-4 border rounded-lg hover:border-blue-500 hover:shadow-md transition cursor-pointer">
                  <h3 className="font-semibold text-lg">{m.group.name}</h3>
                  <p className="text-sm text-gray-500">Joined: {new Date(m.joinedAt).toLocaleDateString()}</p>
                  {m.leftAt && <p className="text-sm text-red-500">Left: {new Date(m.leftAt).toLocaleDateString()}</p>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
