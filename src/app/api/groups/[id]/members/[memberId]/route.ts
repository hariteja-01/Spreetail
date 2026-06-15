import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function DELETE(request: Request, props: { params: Promise<{ id: string, memberId: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await props.params;

    const group = await prisma.group.findUnique({
      where: { id: params.id },
      include: { members: { orderBy: { joinedAt: 'asc' } } },
    });

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    // Determine the owner (earliest joined member)
    const owner = group.members[0];
    if (owner.userId !== session.id) {
      return NextResponse.json({ error: 'Only the group owner can remove members' }, { status: 403 });
    }

    if (params.memberId === session.id) {
      return NextResponse.json({ error: 'You cannot remove yourself' }, { status: 400 });
    }

    // Find the specific GroupMember record
    const targetMember = group.members.find(m => m.userId === params.memberId);
    if (!targetMember) {
      return NextResponse.json({ error: 'Member not found in group' }, { status: 404 });
    }

    if (targetMember.leftAt) {
      return NextResponse.json({ error: 'Member has already been removed' }, { status: 400 });
    }

    // Soft delete by setting leftAt, preserving their historical expense splits
    await prisma.groupMember.update({
      where: { id: targetMember.id },
      data: { leftAt: new Date() }
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Remove member error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
