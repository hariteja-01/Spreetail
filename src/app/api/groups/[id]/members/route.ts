import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import crypto from 'crypto';

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name } = await request.json();
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const params = await props.params;

    const group = await prisma.group.findUnique({
      where: { id: params.id },
      include: { members: true },
    });

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    // Check if user is a member of the group to allow adding new members
    if (!group.members.some(m => m.userId === session.id)) {
      return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 });
    }

    // Create a guest user
    const safeName = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const uid = crypto.randomBytes(4).toString('hex');
    const guestEmail = `${safeName}_${uid}@guest.local`;
    const randomPassword = crypto.randomBytes(16).toString('hex'); // Unusable password

    const newUser = await prisma.user.create({
      data: {
        name: name.trim(),
        email: guestEmail,
        password: randomPassword,
      }
    });

    // Add to group
    await prisma.groupMember.create({
      data: {
        groupId: group.id,
        userId: newUser.id,
      }
    });

    return NextResponse.json({ success: true, member: newUser });
  } catch (err: any) {
    console.error('Add member error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
