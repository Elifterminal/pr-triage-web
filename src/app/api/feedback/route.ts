import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { analysisId, feedbackType, overrideRecommendation, comment } = body;

  if (!analysisId || !feedbackType) {
    return NextResponse.json(
      { error: 'analysisId and feedbackType are required' },
      { status: 400 }
    );
  }

  if (!['AGREE', 'DISAGREE'].includes(feedbackType)) {
    return NextResponse.json(
      { error: 'feedbackType must be AGREE or DISAGREE' },
      { status: 400 }
    );
  }

  // Verify the analysis belongs to this user
  const analysis = await db.analysis.findFirst({
    where: { id: analysisId, userId: session.user.id },
  });

  if (!analysis) {
    return NextResponse.json(
      { error: 'Analysis not found' },
      { status: 404 }
    );
  }

  // Upsert feedback (one per user per analysis)
  const feedback = await db.feedback.upsert({
    where: {
      analysisId_userId: {
        analysisId,
        userId: session.user.id,
      },
    },
    update: {
      feedbackType,
      overrideRecommendation: overrideRecommendation || null,
      comment: comment || null,
    },
    create: {
      analysisId,
      userId: session.user.id,
      feedbackType,
      overrideRecommendation: overrideRecommendation || null,
      comment: comment || null,
    },
  });

  return NextResponse.json(feedback);
}
