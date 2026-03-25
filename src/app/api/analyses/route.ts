import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  const [analyses, total] = await Promise.all([
    db.analysis.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        prUrl: true,
        prOwner: true,
        prRepo: true,
        prNumber: true,
        prTitle: true,
        mode: true,
        status: true,
        compositeScore: true,
        confidenceLevel: true,
        recommendation: true,
        createdAt: true,
        completedAt: true,
      },
    }),
    db.analysis.count({ where: { userId: session.user.id } }),
  ]);

  return NextResponse.json({ analyses, total, limit, offset });
}
