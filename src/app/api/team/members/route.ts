import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getTierLimits } from '@/lib/tiers';
import { sendTeamInvite } from '@/lib/email';
import { randomUUID } from 'crypto';

// POST /api/team/members — invite a member
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const team = await db.team.findFirst({
    where: { ownerId: session.user.id },
    include: { members: true },
  });

  if (!team) {
    return NextResponse.json({ error: 'You don\'t have a team. Create one first.' }, { status: 400 });
  }

  // Check member limit
  const user = await db.user.findUnique({ where: { id: session.user.id } });
  const limits = getTierLimits(user?.plan || 'FREE');
  if (team.members.length >= limits.teamMembers) {
    return NextResponse.json({
      error: `Team member limit reached (${limits.teamMembers}). Upgrade your plan for more.`,
    }, { status: 403 });
  }

  const { email } = await req.json();
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Check if already a member
  const existing = await db.teamMember.findUnique({
    where: { teamId_email: { teamId: team.id, email: normalizedEmail } },
  });
  if (existing) {
    return NextResponse.json({ error: 'This email is already on the team' }, { status: 400 });
  }

  // Find if user exists
  const invitedUser = await db.user.findFirst({
    where: { email: normalizedEmail },
  });

  const inviteToken = randomUUID();
  const member = await db.teamMember.create({
    data: {
      teamId: team.id,
      email: normalizedEmail,
      userId: invitedUser?.id || null,
      role: 'MEMBER',
      status: 'PENDING',
      inviteToken,
    },
  });

  // Send invite email
  const baseUrl = process.env.NEXTAUTH_URL || 'https://pr-triage-web.vercel.app';
  try {
    await sendTeamInvite({
      to: normalizedEmail,
      teamName: team.name,
      inviterName: session.user.name || 'A PR Triage user',
      inviteUrl: `${baseUrl}/api/team/invite/accept?token=${inviteToken}`,
    });
  } catch (err) {
    // Email failed but invite was created — they can still accept via link
    console.error('Failed to send invite email:', err);
  }

  return NextResponse.json({ member, inviteUrl: `${baseUrl}/api/team/invite/accept?token=${inviteToken}` });
}

// DELETE /api/team/members — remove a member
export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const memberId = searchParams.get('id');
  if (!memberId) {
    return NextResponse.json({ error: 'Member ID required' }, { status: 400 });
  }

  const team = await db.team.findFirst({ where: { ownerId: session.user.id } });
  if (!team) {
    return NextResponse.json({ error: 'Not a team owner' }, { status: 403 });
  }

  const member = await db.teamMember.findFirst({
    where: { id: memberId, teamId: team.id },
  });
  if (!member) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }
  if (member.role === 'OWNER') {
    return NextResponse.json({ error: 'Cannot remove the team owner' }, { status: 400 });
  }

  await db.teamMember.delete({ where: { id: memberId } });
  return NextResponse.json({ ok: true });
}
