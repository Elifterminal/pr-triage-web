import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { parsePRUrl, fetchPRData } from '@/engine/github';
import { runTriage } from '@/engine/triage';
import { ProviderType } from '@/engine/types';
import { canPerformAnalysis, getTierLimits } from '@/lib/tiers';

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { prUrls, mode: requestedMode } = body;

  if (!Array.isArray(prUrls) || prUrls.length === 0) {
    return NextResponse.json({ error: 'prUrls array is required' }, { status: 400 });
  }

  if (prUrls.length > 10) {
    return NextResponse.json({ error: 'Maximum 10 PRs per batch' }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: { apiKeys: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const tierLimits = getTierLimits(user.plan);
  if (!tierLimits.batchAnalysis) {
    return NextResponse.json({ error: 'Batch analysis requires Pro or Team plan' }, { status: 403 });
  }

  const apiKeyRecord = user.apiKeys[0];
  if (!apiKeyRecord) {
    return NextResponse.json({ error: 'No API key configured. Add one in Settings.' }, { status: 400 });
  }

  const apiKey = decrypt(apiKeyRecord.encryptedKey);

  // Get GitHub token
  const account = await db.account.findFirst({
    where: { userId: session.user.id, provider: 'github' },
  });
  const githubToken = account?.access_token || undefined;

  // Parse all URLs upfront
  const parsed = prUrls.map((url: string) => {
    const p = parsePRUrl(url);
    return { url, parsed: p };
  });

  const invalid = parsed.filter(p => !p.parsed);
  if (invalid.length > 0) {
    return NextResponse.json({
      error: `Invalid PR URLs: ${invalid.map(p => p.url).join(', ')}`,
    }, { status: 400 });
  }

  // Count today's analyses for limit checking
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  let todayCount = await db.analysis.count({
    where: {
      userId: session.user.id,
      status: 'COMPLETE',
      createdAt: { gte: todayStart },
    },
  });

  const results: Array<{ url: string; id?: string; error?: string; cached?: boolean }> = [];
  const mode = (requestedMode === 'DEEP' && tierLimits.deepAnalysis) ? 'DEEP' as const : 'QUICK' as const;

  for (const item of parsed) {
    const pr = item.parsed!;

    // Check daily limit per iteration
    const limitCheck = canPerformAnalysis(user.plan, todayCount);
    if (!limitCheck.allowed) {
      results.push({ url: item.url, error: limitCheck.reason });
      continue;
    }

    // Check for recent cached result
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const existing = await db.analysis.findFirst({
      where: {
        userId: session.user.id,
        prOwner: pr.owner,
        prRepo: pr.repo,
        prNumber: pr.number,
        status: 'COMPLETE',
        completedAt: { gte: oneHourAgo },
      },
      orderBy: { completedAt: 'desc' },
    });

    if (existing) {
      results.push({ url: item.url, id: existing.id, cached: true });
      continue;
    }

    // Create analysis record
    const analysis = await db.analysis.create({
      data: {
        userId: session.user.id,
        prUrl: item.url,
        prOwner: pr.owner,
        prRepo: pr.repo,
        prNumber: pr.number,
        status: 'PROCESSING',
        mode,
      },
    });

    try {
      const prData = await fetchPRData(pr.owner, pr.repo, pr.number, githubToken);
      const result = await runTriage(prData, {
        apiKey,
        provider: apiKeyRecord.provider as ProviderType,
      });

      await db.analysis.update({
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

      results.push({ url: item.url, id: analysis.id });
      todayCount++;
    } catch (error) {
      await db.analysis.update({
        where: { id: analysis.id },
        data: {
          status: 'FAILED',
          resultData: JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error',
          }),
        },
      });

      results.push({
        url: item.url,
        id: analysis.id,
        error: error instanceof Error ? error.message : 'Analysis failed',
      });
    }
  }

  return NextResponse.json({ results });
}
