import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendDigestEmail } from '@/lib/email';

// Vercel cron: GET /api/cron/digest
// Configured in vercel.json: runs daily at 9am UTC
export async function GET(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();

  // Find all users with digest enabled
  const prefs = await db.digestPreference.findMany({
    where: { enabled: true },
    include: {
      user: { select: { id: true, name: true, email: true, plan: true } },
    },
  });

  let sent = 0;
  let errors = 0;

  for (const pref of prefs) {
    if (!pref.user.email) continue;

    // Check frequency
    if (pref.frequency === 'WEEKLY' && now.getDay() !== 1) continue; // Weekly = Mondays only
    if (pref.lastSentAt) {
      const hoursSinceLast = (now.getTime() - pref.lastSentAt.getTime()) / (1000 * 60 * 60);
      if (pref.frequency === 'DAILY' && hoursSinceLast < 20) continue;
      if (pref.frequency === 'WEEKLY' && hoursSinceLast < 144) continue; // ~6 days
    }

    // Get analyses since last digest (or last 24h for daily, 7d for weekly)
    const sinceDate = pref.lastSentAt || new Date(
      now.getTime() - (pref.frequency === 'WEEKLY' ? 7 : 1) * 24 * 60 * 60 * 1000
    );

    const analyses = await db.analysis.findMany({
      where: {
        userId: pref.user.id,
        status: 'COMPLETE',
        completedAt: { gte: sinceDate },
      },
      orderBy: { completedAt: 'desc' },
      take: 50,
    });

    if (analyses.length === 0) continue;

    try {
      await sendDigestEmail({
        to: pref.user.email,
        userName: pref.user.name || 'there',
        period: pref.frequency === 'WEEKLY' ? 'Weekly' : 'Daily',
        analyses: analyses.map(a => ({
          prTitle: a.prTitle || `${a.prOwner}/${a.prRepo}#${a.prNumber}`,
          prUrl: a.prUrl,
          score: a.compositeScore || 0,
          recommendation: a.recommendation || 'N/A',
          createdAt: (a.completedAt || a.createdAt).toISOString(),
        })),
      });

      await db.digestPreference.update({
        where: { id: pref.id },
        data: { lastSentAt: now },
      });

      sent++;
    } catch (err) {
      console.error(`Digest email failed for ${pref.user.email}:`, err);
      errors++;
    }
  }

  return NextResponse.json({ sent, errors, total: prefs.length });
}
