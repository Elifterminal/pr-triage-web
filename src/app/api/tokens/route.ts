import { NextResponse } from 'next/server';
import { randomBytes, createHash } from 'crypto';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getTierLimits } from '@/lib/tiers';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tokens = await db.apiToken.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      tokenPrefix: true,
      label: true,
      lastUsedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ tokens });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { plan: true },
  });

  if (!user || !getTierLimits(user.plan).apiAccess) {
    return NextResponse.json({ error: 'API access requires Team plan' }, { status: 403 });
  }

  // Check max 5 tokens
  const count = await db.apiToken.count({
    where: { userId: session.user.id },
  });

  if (count >= 5) {
    return NextResponse.json({ error: 'Maximum 5 API tokens. Revoke one first.' }, { status: 400 });
  }

  const body = await req.json();
  const label = (body.label || 'API Token').slice(0, 64);

  // Generate token: pt_ prefix + 32 random bytes hex
  const raw = randomBytes(32).toString('hex');
  const token = `pt_${raw}`;
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const tokenPrefix = `pt_${raw.slice(0, 8)}...`;

  await db.apiToken.create({
    data: {
      userId: session.user.id,
      tokenHash,
      tokenPrefix,
      label,
    },
  });

  // Return the full token ONCE — it cannot be retrieved after this
  return NextResponse.json({ token, tokenPrefix, label });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { tokenId } = body;

  if (!tokenId) {
    return NextResponse.json({ error: 'tokenId required' }, { status: 400 });
  }

  const token = await db.apiToken.findUnique({
    where: { id: tokenId },
    select: { userId: true },
  });

  if (!token || token.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await db.apiToken.delete({ where: { id: tokenId } });

  return NextResponse.json({ ok: true });
}
