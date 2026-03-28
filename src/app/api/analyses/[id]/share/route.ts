import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getTierLimits } from '@/lib/tiers';

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { plan: true },
  });

  if (!user || !getTierLimits(user.plan).shareableLinks) {
    return NextResponse.json({ error: 'Shareable links require Pro or Team plan' }, { status: 403 });
  }

  const analysis = await db.analysis.findUnique({
    where: { id: params.id },
    select: { userId: true, shareToken: true, status: true },
  });

  if (!analysis || analysis.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (analysis.status !== 'COMPLETE') {
    return NextResponse.json({ error: 'Analysis not complete' }, { status: 400 });
  }

  // Return existing token if already shared
  if (analysis.shareToken) {
    return NextResponse.json({ shareToken: analysis.shareToken, url: `/share/${analysis.shareToken}` });
  }

  const token = randomUUID();
  await db.analysis.update({
    where: { id: params.id },
    data: { shareToken: token },
  });

  return NextResponse.json({ shareToken: token, url: `/share/${token}` });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const analysis = await db.analysis.findUnique({
    where: { id: params.id },
    select: { userId: true },
  });

  if (!analysis || analysis.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await db.analysis.update({
    where: { id: params.id },
    data: { shareToken: null },
  });

  return NextResponse.json({ ok: true });
}
