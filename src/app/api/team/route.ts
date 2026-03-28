import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getTierLimits } from '@/lib/tiers';

// GET /api/team — get user's team
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if user owns a team
  const team = await db.team.findFirst({
    where: { ownerId: session.user.id },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  // Also check if user is a member of another team
  const membership = team ? null : await db.teamMember.findFirst({
    where: { userId: session.user.id, status: 'ACTIVE' },
    include: {
      team: {
        include: {
          owner: { select: { id: true, name: true, email: true, image: true } },
          members: {
            include: {
              user: { select: { id: true, name: true, email: true, image: true } },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      },
    },
  });

  if (team) {
    return NextResponse.json({ team, role: 'OWNER' });
  }

  if (membership) {
    return NextResponse.json({ team: membership.team, role: membership.role });
  }

  return NextResponse.json({ team: null });
}

// POST /api/team — create a team
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check tier
  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const limits = getTierLimits(user.plan);
  if (limits.teamMembers === 0) {
    return NextResponse.json({ error: 'Team features require the Team plan' }, { status: 403 });
  }

  // Check user doesn't already own a team
  const existing = await db.team.findFirst({ where: { ownerId: session.user.id } });
  if (existing) {
    return NextResponse.json({ error: 'You already have a team' }, { status: 400 });
  }

  const { name } = await req.json();
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: 'Team name is required' }, { status: 400 });
  }

  const team = await db.team.create({
    data: {
      name: name.trim(),
      ownerId: session.user.id,
      members: {
        create: {
          email: user.email || '',
          userId: session.user.id,
          role: 'OWNER',
          status: 'ACTIVE',
        },
      },
    },
    include: { members: true },
  });

  return NextResponse.json({ team });
}
