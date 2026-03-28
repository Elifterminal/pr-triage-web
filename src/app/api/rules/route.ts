import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getTierLimits } from '@/lib/tiers';

const DIMENSION_KEYS = [
  'issue_fit', 'substance', 'pattern_alignment',
  'scope_match', 'test_signal', 'risk_flags',
];

const DEFAULT_WEIGHTS: Record<string, number> = {
  issue_fit: 0.30,
  substance: 0.25,
  pattern_alignment: 0.15,
  scope_match: 0.15,
  test_signal: 0.10,
  risk_flags: 0.05,
};

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rule = await db.customRule.findUnique({
    where: { userId: session.user.id },
  });

  return NextResponse.json({
    dimensionWeights: rule?.dimensionWeights || DEFAULT_WEIGHTS,
    minScoreThreshold: rule?.minScoreThreshold ?? null,
    isCustom: !!rule,
    defaults: DEFAULT_WEIGHTS,
  });
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { plan: true },
  });

  if (!user || !getTierLimits(user.plan).customRules) {
    return NextResponse.json({ error: 'Custom rules require Team plan' }, { status: 403 });
  }

  const body = await req.json();
  const { dimensionWeights, minScoreThreshold } = body;

  // Validate weights
  if (dimensionWeights) {
    const keys = Object.keys(dimensionWeights);
    const hasAllKeys = DIMENSION_KEYS.every(k => keys.includes(k));
    if (!hasAllKeys) {
      return NextResponse.json({ error: 'All 6 dimension keys must be present' }, { status: 400 });
    }

    const sum = Object.values(dimensionWeights).reduce((a: number, b) => a + (b as number), 0);
    if (Math.abs(sum - 1.0) > 0.01) {
      return NextResponse.json({ error: `Weights must sum to 1.0 (currently ${sum.toFixed(3)})` }, { status: 400 });
    }

    // Ensure all values are positive
    for (const [k, v] of Object.entries(dimensionWeights)) {
      if (typeof v !== 'number' || v < 0) {
        return NextResponse.json({ error: `Weight for ${k} must be a non-negative number` }, { status: 400 });
      }
    }
  }

  if (minScoreThreshold !== undefined && minScoreThreshold !== null) {
    if (typeof minScoreThreshold !== 'number' || minScoreThreshold < 0 || minScoreThreshold > 100) {
      return NextResponse.json({ error: 'minScoreThreshold must be 0-100' }, { status: 400 });
    }
  }

  const rule = await db.customRule.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      dimensionWeights: dimensionWeights || DEFAULT_WEIGHTS,
      minScoreThreshold: minScoreThreshold ?? null,
    },
    update: {
      dimensionWeights: dimensionWeights || undefined,
      minScoreThreshold: minScoreThreshold !== undefined ? minScoreThreshold : undefined,
    },
  });

  return NextResponse.json({
    dimensionWeights: rule.dimensionWeights,
    minScoreThreshold: rule.minScoreThreshold,
  });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await db.customRule.deleteMany({
    where: { userId: session.user.id },
  });

  return NextResponse.json({ ok: true, defaults: DEFAULT_WEIGHTS });
}
