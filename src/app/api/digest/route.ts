import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

// GET /api/digest — get digest preferences
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const pref = await db.digestPreference.findUnique({
    where: { userId: session.user.id },
  });

  return NextResponse.json({
    enabled: pref?.enabled ?? false,
    frequency: pref?.frequency ?? 'DAILY',
    lastSentAt: pref?.lastSentAt,
  });
}

// PUT /api/digest — update digest preferences
export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { enabled, frequency } = await req.json();

  if (typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled must be a boolean' }, { status: 400 });
  }
  if (frequency && !['DAILY', 'WEEKLY'].includes(frequency)) {
    return NextResponse.json({ error: 'frequency must be DAILY or WEEKLY' }, { status: 400 });
  }

  const pref = await db.digestPreference.upsert({
    where: { userId: session.user.id },
    update: { enabled, frequency: frequency || 'DAILY' },
    create: { userId: session.user.id, enabled, frequency: frequency || 'DAILY' },
  });

  return NextResponse.json(pref);
}
