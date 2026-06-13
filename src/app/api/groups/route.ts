import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { name, currency } = await request.json();

    const group = await prisma.group.create({
      data: {
        name,
        currency: currency || 'INR',
        members: {
          create: {
            userId: session.id,
            joinedAt: new Date(),
          }
        }
      }
    });

    return NextResponse.json({ success: true, group });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
