import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await props.params;

    const group = await prisma.group.findUnique({
      where: { id: params.id },
      include: { members: true },
    });

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    // Must be a member to delete it
    if (!group.members.some(m => m.userId === session.id)) {
      return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 });
    }

    // Prisma relation ON DELETE CASCADE handles deleting members, expenses, payments, etc.
    // Assuming schema is configured correctly, otherwise we might need to delete relations manually.
    // Given the previous setup, Prisma `onDelete: Cascade` should be active. Let's just delete the group.
    await prisma.group.delete({
      where: { id: params.id }
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Delete group error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
