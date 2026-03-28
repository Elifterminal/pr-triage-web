import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

// GET /api/team/invite/accept?token=xxx — accept an invite
export async function GET(req: Request) {
  const session = await auth();
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(new URL('/login?error=invalid_invite', req.url));
  }

  const member = await db.teamMember.findUnique({
    where: { inviteToken: token },
    include: { team: true },
  });

  if (!member || member.status === 'ACTIVE') {
    return NextResponse.redirect(new URL('/dashboard?error=invalid_invite', req.url));
  }

  if (!session?.user?.id) {
    // Not logged in — redirect to login with return URL
    const returnUrl = `/api/team/invite/accept?token=${token}`;
    return NextResponse.redirect(new URL(`/login?callbackUrl=${encodeURIComponent(returnUrl)}`, req.url));
  }

  // Accept the invite
  await db.teamMember.update({
    where: { id: member.id },
    data: {
      userId: session.user.id,
      status: 'ACTIVE',
      inviteToken: null,
    },
  });

  return NextResponse.redirect(new URL(`/settings?joined=${member.team.name}`, req.url));
}
