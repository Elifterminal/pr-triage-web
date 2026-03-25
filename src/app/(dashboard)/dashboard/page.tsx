import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getTierLimits, TIER_LABELS, type PlanTier } from '@/lib/tiers';

const ACTION_LABELS: Record<string, { label: string; variant: 'success' | 'info' | 'warning' | 'danger' | 'secondary' }> = {
  PRIORITIZE: { label: 'Prioritize', variant: 'success' },
  REVIEW: { label: 'Review', variant: 'info' },
  BATCH: { label: 'Batch', variant: 'secondary' },
  IGNORE: { label: 'Ignore', variant: 'danger' },
  NEEDS_HUMAN_JUDGMENT: { label: 'Needs Judgment', variant: 'warning' },
  // Legacy compat
  REVIEW_NOW: { label: 'Prioritize', variant: 'success' },
  REVIEW_SOON: { label: 'Review', variant: 'info' },
  LOW_PRIORITY: { label: 'Batch', variant: 'secondary' },
  LIKELY_NOT_WORTH_REVIEW: { label: 'Ignore', variant: 'danger' },
};

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-blue-400';
  if (score >= 40) return 'text-yellow-400';
  return 'text-red-400';
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [recentAnalyses, stats, hasApiKey, userRecord, todayCount] = await Promise.all([
    db.analysis.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        prUrl: true,
        prOwner: true,
        prRepo: true,
        prNumber: true,
        prTitle: true,
        status: true,
        compositeScore: true,
        recommendation: true,
        createdAt: true,
      },
    }),
    db.analysis.aggregate({
      where: { userId: session.user.id, status: 'COMPLETE' },
      _count: true,
      _avg: { compositeScore: true },
    }),
    db.apiKey.findFirst({
      where: { userId: session.user.id },
      select: { id: true },
    }),
    db.user.findUnique({
      where: { id: session.user.id },
      select: { plan: true },
    }),
    db.analysis.count({
      where: {
        userId: session.user.id,
        createdAt: { gte: todayStart },
      },
    }),
  ]);

  const plan = (userRecord?.plan || 'FREE') as PlanTier;
  const tierLimits = getTierLimits(plan);
  const totalAnalyses = stats._count;
  const avgScore = stats._avg.compositeScore
    ? Math.round(stats._avg.compositeScore)
    : null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Your PR triage overview
          </p>
        </div>
        <Link href="/analyze">
          <Button>Analyze a PR</Button>
        </Link>
      </div>

      {/* Setup prompt */}
      {!hasApiKey && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="text-2xl">&#9888;</div>
              <div>
                <h3 className="font-semibold mb-1">Add your API key</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  You need an LLM API key (Anthropic or OpenAI) to analyze pull requests.
                  Your key is encrypted and never shared.
                </p>
                <Link href="/settings">
                  <Button size="sm" variant="outline">Go to Settings</Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Analyses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalAnalyses}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Average Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${avgScore ? getScoreColor(avgScore) : ''}`}>
              {avgScore !== null ? avgScore : '—'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {tierLimits.dailyAnalyses > 0 ? 'Today\'s Usage' : 'Plan'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tierLimits.dailyAnalyses > 0 ? (
              <div className="text-3xl font-bold">{todayCount}/{tierLimits.dailyAnalyses}</div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-3xl font-bold">{TIER_LABELS[plan]}</span>
                <Badge variant="success" className="text-xs">{tierLimits.dailyAnalyses === 0 ? 'Unlimited' : ''}</Badge>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent analyses */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Recent Analyses</h2>
        {recentAnalyses.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">
                No analyses yet. Paste a GitHub PR URL to get started.
              </p>
              <Link href="/analyze">
                <Button>Analyze Your First PR</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {recentAnalyses.map((a) => {
              const rec = a.recommendation
                ? ACTION_LABELS[a.recommendation]
                : null;

              return (
                <Link key={a.id} href={`/analysis/${a.id}`}>
                  <div className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition cursor-pointer">
                    {/* Score */}
                    <div className="w-14 text-center">
                      {a.status === 'COMPLETE' && a.compositeScore !== null ? (
                        <span className={`text-xl font-bold tabular-nums ${getScoreColor(a.compositeScore)}`}>
                          {a.compositeScore}
                        </span>
                      ) : a.status === 'PROCESSING' ? (
                        <span className="text-sm text-muted-foreground">...</span>
                      ) : a.status === 'FAILED' ? (
                        <span className="text-sm text-red-400">ERR</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </div>

                    {/* PR info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">
                          {a.prTitle || `${a.prOwner}/${a.prRepo}#${a.prNumber}`}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {a.prOwner}/{a.prRepo}#{a.prNumber}
                      </div>
                    </div>

                    {/* Recommendation badge */}
                    <div className="flex items-center gap-3">
                      {rec && (
                        <Badge variant={rec.variant}>{rec.label}</Badge>
                      )}
                      <span className="text-xs text-muted-foreground w-16 text-right">
                        {timeAgo(a.createdAt)}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
