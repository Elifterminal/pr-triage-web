import { createHash } from 'crypto';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

interface AuthResult {
  userId: string;
  via: 'session' | 'token';
}

/**
 * Authenticate a request via Bearer token or session.
 * Bearer tokens are SHA-256 hashed before lookup.
 */
export async function authenticateRequest(req: Request): Promise<AuthResult | null> {
  // Check for Bearer token first
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer pt_')) {
    const token = authHeader.slice(7); // Remove "Bearer "
    const hash = createHash('sha256').update(token).digest('hex');

    const apiToken = await db.apiToken.findUnique({
      where: { tokenHash: hash },
      select: { userId: true, id: true },
    });

    if (!apiToken) return null;

    // Update last used timestamp (fire and forget)
    db.apiToken.update({
      where: { id: apiToken.id },
      data: { lastUsedAt: new Date() },
    }).catch(() => {});

    return { userId: apiToken.userId, via: 'token' };
  }

  // Fall back to session auth
  const session = await auth();
  if (session?.user?.id) {
    return { userId: session.user.id, via: 'session' };
  }

  return null;
}
