import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getTierLimits } from '@/lib/tiers';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const repos = await db.connectedRepo.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ repos });
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

  const tierLimits = getTierLimits(user?.plan || 'FREE');
  if (tierLimits.connectedRepos <= 0) {
    return NextResponse.json({ error: 'Connected repos require Pro or Team plan' }, { status: 403 });
  }

  // Check count limit
  const count = await db.connectedRepo.count({
    where: { userId: session.user.id },
  });

  if (count >= tierLimits.connectedRepos) {
    return NextResponse.json({
      error: `Maximum ${tierLimits.connectedRepos} connected repos on your plan`,
    }, { status: 400 });
  }

  const body = await req.json();
  const { owner, repo } = body;

  if (!owner || !repo) {
    return NextResponse.json({ error: 'owner and repo are required' }, { status: 400 });
  }

  // Check if already connected
  const existing = await db.connectedRepo.findUnique({
    where: { userId_owner_repo: { userId: session.user.id, owner, repo } },
  });

  if (existing) {
    return NextResponse.json({ error: 'Repo already connected' }, { status: 400 });
  }

  // Get user's GitHub token
  const account = await db.account.findFirst({
    where: { userId: session.user.id, provider: 'github' },
  });

  if (!account?.access_token) {
    return NextResponse.json({ error: 'No GitHub token found. Please re-authenticate with GitHub.' }, { status: 400 });
  }

  // Create webhook on GitHub
  const webhookSecret = randomBytes(32).toString('hex');
  const webhookUrl = `${process.env.NEXTAUTH_URL || 'https://pr-triage-web.vercel.app'}/api/webhooks/github`;

  let webhookId: number | null = null;
  try {
    const ghRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/hooks`, {
      method: 'POST',
      headers: {
        Authorization: `token ${account.access_token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'web',
        active: true,
        events: ['pull_request'],
        config: {
          url: webhookUrl,
          content_type: 'json',
          secret: webhookSecret,
          insecure_ssl: '0',
        },
      }),
    });

    if (!ghRes.ok) {
      const ghErr = await ghRes.json().catch(() => ({}));
      if (ghRes.status === 404) {
        return NextResponse.json({ error: 'Repository not found or you lack admin access' }, { status: 404 });
      }
      return NextResponse.json({
        error: `GitHub webhook creation failed: ${(ghErr as Record<string, string>).message || ghRes.statusText}`,
      }, { status: 400 });
    }

    const ghData = await ghRes.json();
    webhookId = ghData.id;
  } catch (err) {
    return NextResponse.json({
      error: `Failed to create GitHub webhook: ${err instanceof Error ? err.message : 'Unknown error'}`,
    }, { status: 500 });
  }

  const connected = await db.connectedRepo.create({
    data: {
      userId: session.user.id,
      owner,
      repo,
      webhookId,
      webhookSecret,
      isActive: true,
    },
  });

  return NextResponse.json({ repo: connected });
}
