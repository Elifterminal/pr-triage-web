import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { parsePRUrl, fetchPRData } from '@/engine/github';
import { runTriage } from '@/engine/triage';
import { ProviderType } from '@/engine/types';
import { canPerformAnalysis, getTierLimits } from '@/lib/tiers';
import { authenticateRequest } from '@/lib/api-auth';

export async function POST(req: NextRequest) {
  const authResult = await authenticateRequest(req);
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Token auth requires apiAccess tier gate
  if (authResult.via === 'token') {
    const tokenUser = await db.user.findUnique({
      where: { id: authResult.userId },
      select: { plan: true },
    });
    if (!tokenUser || !getTierLimits(tokenUser.plan).apiAccess) {
      return NextResponse.json({ error: 'API access requires Team plan' }, { status: 403 });
    }
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
    where: { id: authResult.userId },
    include: { apiKeys: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Count today's COMPLETED analyses for daily limit check
  // Failed analyses don't count against the limit
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayCount = await db.analysis.count({
    where: {
      userId: authResult.userId,
      status: 'COMPLETE',
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
      userId: authResult.userId,
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
      userId: authResult.userId,
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
      where: { userId: authResult.userId, provider: 'github' },
    });
    const githubToken = account?.access_token || undefined;

    const prData = await fetchPRData(
      parsed.owner,
      parsed.repo,
      parsed.number,
      githubToken
    );

    // Fetch custom weights if user has them
    const customRule = await db.customRule.findUnique({
      where: { userId: authResult.userId },
      select: { dimensionWeights: true },
    });

    // Run triage
    const result = await runTriage(prData, {
      apiKey,
      provider: apiKeyRecord.provider as ProviderType,
      mode: analysis.mode as 'QUICK' | 'DEEP',
      customWeights: customRule?.dimensionWeights as Record<string, number> | undefined,
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

    // Return user-friendly error messages
    const rawMessage = error instanceof Error ? error.message : 'Analysis failed';
    const friendlyMessage = getFriendlyError(rawMessage);

    return NextResponse.json(
      { error: friendlyMessage },
      { status: 500 }
    );
  }
}

function getFriendlyError(message: string): string {
  const lower = message.toLowerCase();

  // API key issues
  if (lower.includes('authentication') || lower.includes('api key') || lower.includes('unauthorized') || lower.includes('401')) {
    return 'Your API key appears to be invalid or expired. Please check it in Settings and try again.';
  }
  if (lower.includes('rate limit') || lower.includes('429')) {
    return 'Your API provider rate limit was hit. Please wait a minute and try again.';
  }
  if (lower.includes('insufficient') && lower.includes('quota')) {
    return 'Your API key has run out of credits. Please add credits with your provider or switch to a different key.';
  }

  // GitHub issues
  if (lower.includes('not found') && (lower.includes('pr') || lower.includes('pull') || lower.includes('repo'))) {
    return 'Could not find that pull request. Make sure the URL is correct and the repository is public.';
  }
  if (lower.includes('github') && lower.includes('rate')) {
    return 'GitHub API rate limit reached. Try again in a few minutes.';
  }

  // LLM response issues
  if (lower.includes('json') || lower.includes('parse') || lower.includes('unexpected token')) {
    return 'The AI returned an unexpected response. Please try again — this is usually a one-off issue.';
  }

  // Network issues
  if (lower.includes('timeout') || lower.includes('econnrefused') || lower.includes('network')) {
    return 'Network error connecting to the API. Please check your connection and try again.';
  }

  // Fallback — don't expose raw internal errors
  return 'Something went wrong during analysis. Please try again. If the issue persists, check your API key in Settings.';
}
