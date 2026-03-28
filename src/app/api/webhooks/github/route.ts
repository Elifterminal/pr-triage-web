import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { db } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { parsePRUrl, fetchPRData } from '@/engine/github';
import { runTriage } from '@/engine/triage';
import { ProviderType } from '@/engine/types';

export const maxDuration = 120;

function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expected = 'sha256=' + createHmac('sha256', secret).update(payload).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const event = req.headers.get('x-github-event');
  if (event !== 'pull_request') {
    return NextResponse.json({ ok: true, skipped: 'not a PR event' });
  }

  const rawBody = await req.text();
  const signature = req.headers.get('x-hub-signature-256') || '';

  let payload: {
    action: string;
    pull_request: {
      html_url: string;
      title: string;
      number: number;
    };
    repository: {
      owner: { login: string };
      name: string;
    };
  };

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Only trigger on opened or synchronized (new commits pushed)
  if (!['opened', 'synchronize'].includes(payload.action)) {
    return NextResponse.json({ ok: true, skipped: `action: ${payload.action}` });
  }

  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;

  // Find all connected repos for this owner/repo
  const connectedRepos = await db.connectedRepo.findMany({
    where: { owner, repo, isActive: true },
  });

  if (connectedRepos.length === 0) {
    return NextResponse.json({ ok: true, skipped: 'no connected repo' });
  }

  // Verify signature against at least one connected repo's secret
  const verified = connectedRepos.find(cr =>
    cr.webhookSecret && verifySignature(rawBody, signature, cr.webhookSecret)
  );

  if (!verified) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const prUrl = payload.pull_request.html_url;
  const prNumber = payload.pull_request.number;
  const prTitle = payload.pull_request.title;

  // Process analysis for the verified user
  const userId = verified.userId;

  // Get user's API key
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { apiKeys: true },
  });

  if (!user || !user.apiKeys[0]) {
    return NextResponse.json({ ok: true, skipped: 'no API key configured' });
  }

  const apiKey = decrypt(user.apiKeys[0].encryptedKey);

  // Check for recent analysis (dedup)
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const existing = await db.analysis.findFirst({
    where: {
      userId,
      prOwner: owner,
      prRepo: repo,
      prNumber,
      createdAt: { gte: fiveMinAgo },
    },
  });

  if (existing) {
    return NextResponse.json({ ok: true, skipped: 'recent analysis exists' });
  }

  // Create analysis record
  const analysis = await db.analysis.create({
    data: {
      userId,
      prUrl,
      prOwner: owner,
      prRepo: repo,
      prNumber,
      prTitle,
      status: 'PROCESSING',
      mode: 'QUICK',
    },
  });

  // Fetch and analyze (inline — within maxDuration)
  try {
    const account = await db.account.findFirst({
      where: { userId, provider: 'github' },
    });

    const prData = await fetchPRData(owner, repo, prNumber, account?.access_token || undefined);

    // Fetch custom weights
    const customRule = await db.customRule.findUnique({
      where: { userId },
      select: { dimensionWeights: true },
    });

    const result = await runTriage(prData, {
      apiKey,
      provider: user.apiKeys[0].provider as ProviderType,
      customWeights: customRule?.dimensionWeights as Record<string, number> | undefined,
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

    return NextResponse.json({ ok: true, analysisId: analysis.id });
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

    return NextResponse.json({ ok: true, analysisId: analysis.id, failed: true });
  }
}
