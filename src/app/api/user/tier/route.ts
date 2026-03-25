import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getTierLimits, TIER_LABELS, type PlanTier } from '@/lib/tiers';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [user, todayCount] = await Promise.all([
    db.user.findUnique({
      where: { id: session.user.id },
      select: { plan: true },
    }),
    db.analysis.count({
      where: {
        userId: session.user.id,
        status: 'COMPLETE',
        createdAt: { gte: todayStart },
      },
    }),
  ]);

  const plan = (user?.plan || 'FREE') as PlanTier;
  const limits = getTierLimits(plan);

  return NextResponse.json({
    plan,
    label: TIER_LABELS[plan],
    limits,
    usage: {
      todayCount,
      remaining: limits.dailyAnalyses === 0 ? null : Math.max(0, limits.dailyAnalyses - todayCount),
    },
  });
}
