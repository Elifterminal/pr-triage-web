import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const repo = await db.connectedRepo.findUnique({
    where: { id: params.id },
  });

  if (!repo || repo.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Remove webhook from GitHub
  if (repo.webhookId) {
    const account = await db.account.findFirst({
      where: { userId: session.user.id, provider: 'github' },
    });

    if (account?.access_token) {
      try {
        await fetch(
          `https://api.github.com/repos/${repo.owner}/${repo.repo}/hooks/${repo.webhookId}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `token ${account.access_token}`,
              Accept: 'application/vnd.github+json',
            },
          }
        );
      } catch {
        // Best effort — webhook cleanup is not critical
      }
    }
  }

  await db.connectedRepo.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}
