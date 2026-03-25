import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { parsePRUrl, fetchPRData } from '@/engine/github';
import { runTriage } from '@/engine/triage';
import { ProviderType } from '@/engine/types';
import { canPerformAnalysis, getTierLimits } from '@/lib/tiers';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { prUrl, mode: requestedMode } = body;

  if (!prUrl || typeof prUrl !== 'string') {
    return NextResponse.json(
      { error: 'PR URL is required' },
      { status: 400 }
    );
  }

  // Parse the PR URL
  const parsed = parsePRUrl(prUrl);
  if (!parsed) {
    return NextResponse.json(
      { error: 'Invalid GitHub PR URL. Expected format: https://github.com/owner/repo/pull/123' },
      { status: 400 }
    );
  }

  // Check analysis limits
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: { apiKeys: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Count today's analyses for daily limit check
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayCount = await db.analysis.count({
    where: {
      userId: session.user.id,
      createdAt: { gte: todayStart },
    },
  });

  const limitCheck = canPerformAnalysis(user.plan, todayCount);
  if (!limitCheck.allowed) {
    return NextResponse.json(
      { error: limitCheck.reason },
      { status: 403 }
    );
  }

  const tierLimits = getTierLimits(user.plan);

  // Get API key
  const apiKeyRecord = user.apiKeys[0];
  if (!apiKeyRecord) {
    return NextResponse.json(
      { error: 'No API key configured. Add one in Settings.' },
      { status: 400 }
    );
  }

  const apiKey = decrypt(apiKeyRecord.encryptedKey);

  // Check for a recent completed analysis of the same PR (within 1 hour)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const existing = await db.analysis.findFirst({
    where: {
      userId: session.user.id,
      prOwner: parsed.owner,
      prRepo: parsed.repo,
      prNumber: parsed.number,
      status: 'COMPLETE',
      completedAt: { gte: oneHourAgo },
    },
    orderBy: { completedAt: 'desc' },
  });

  if (existing) {
    return NextResponse.json({ id: existing.id, cached: true });
  }

  // Create pending analysis record
  const analysis = await db.analysis.create({
    data: {
      userId: session.user.id,
      prUrl,
      prOwner: parsed.owner,
      prRepo: parsed.repo,
      prNumber: parsed.number,
      status: 'PROCESSING',
      mode: (requestedMode === 'DEEP' && tierLimits.deepAnalysis) ? 'DEEP' : 'QUICK',
    },
  });

  try {
    // Fetch PR data from GitHub
    // Use the user's GitHub access token if available
    const account = await db.account.findFirst({
      where: { userId: session.user.id, provider: 'github' },
    });
    const githubToken = account?.access_token || undefined;

    const prData = await fetchPRData(
      parsed.owner,
      parsed.repo,
      parsed.number,
      githubToken
    );

    // Run triage
    const result = await runTriage(prData, {
      apiKey,
      provider: apiKeyRecord.provider as ProviderType,
    });

    // Update analysis with results
    const updated = await db.analysis.update({
      where: { id: analysis.id },
      data: {
        prTitle: prData.title,
        status: 'COMPLETE',
        inputData: JSON.stringify(prData),
        compositeScore: result.compositeScore,
        confidenceLevel: result.confidenceLevel,
        recommendation: result.recommendation,
        resultData: JSON.stringify(result),
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      id: updated.id,
      ...result,
    });
  } catch (error) {
    // Update analysis as failed
    await db.analysis.update({
      where: { id: analysis.id },
      data: {
        status: 'FAILED',
        resultData: JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
      },
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500 }
    );
  }
}
