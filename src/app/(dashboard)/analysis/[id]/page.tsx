import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { ScoreDisplay } from '@/components/score-display';
import { MaintainerGuidance } from '@/components/maintainer-guidance';
import { DimensionBand } from '@/components/dimension-band';
import { ContextStatus } from '@/components/context-status';
import { FeedbackButtons } from '@/components/feedback-buttons';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CopySummary } from '@/components/copy-summary';
import type { TriageResult } from '@/engine/types';

const DIMENSION_LABELS: Record<string, string> = {
  issue_fit: 'Issue Resolution Fit',
  substance: 'Implementation Substance',
  pattern_alignment: 'Pattern Alignment',
  scope_match: 'Scope / Complexity Match',
  test_signal: 'Test Signal',
  risk_flags: 'Risk Flags',
};

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const analysis = await db.analysis.findUnique({
    where: { id: params.id },
    select: { prTitle: true, prOwner: true, prRepo: true, prNumber: true },
  });
  if (!analysis) return { title: 'Analysis' };
  const label = analysis.prTitle || `${analysis.prOwner}/${analysis.prRepo}#${analysis.prNumber}`;
  return { title: label };
}

export default async function AnalysisDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const analysis = await db.analysis.findUnique({
    where: { id: params.id },
    include: {
      feedback: {
        where: { userId: session.user.id },
        select: { feedbackType: true },
      },
    },
  });

  if (!analysis || analysis.userId !== session.user.id) {
    notFound();
  }

  // Handle non-complete states
  if (analysis.status === 'PROCESSING' || analysis.status === 'PENDING') {
    return (
      <div className="max-w-3xl mx-auto text-center py-20">
        <div className="text-4xl mb-4">&#9203;</div>
        <h1 className="text-2xl font-bold mb-2">Analysis in progress</h1>
        <p className="text-muted-foreground mb-6">
          This PR is still being evaluated. Refresh in a moment.
        </p>
        <Link href={`/analysis/${params.id}`}>
          <Button variant="outline">Refresh</Button>
        </Link>
      </div>
    );
  }

  if (analysis.status === 'FAILED') {
    const errorData = analysis.resultData ? JSON.parse(analysis.resultData as string) as { error?: string } : null;
    return (
      <div className="max-w-3xl mx-auto text-center py-20">
        <div className="text-4xl mb-4">&#10060;</div>
        <h1 className="text-2xl font-bold mb-2">Analysis failed</h1>
        <p className="text-muted-foreground mb-6">
          {errorData?.error || 'Something went wrong during analysis.'}
        </p>
        <Link href="/analyze">
          <Button>Try Again</Button>
        </Link>
      </div>
    );
  }

  const rawResult = analysis.resultData ? JSON.parse(analysis.resultData as string) as TriageResult : null;
  // Normalize legacy action names (IGNORE → CLOSE)
  const result = rawResult ? {
    ...rawResult,
    action: (rawResult.action as string) === 'IGNORE' ? 'CLOSE' : rawResult.action,
    recommendation: (rawResult.recommendation as string) === 'IGNORE' ? 'CLOSE' : rawResult.recommendation,
  } as TriageResult : null;
  const userFeedback = (analysis.feedback[0]?.feedbackType as 'AGREE' | 'DISAGREE') || null;

  // Derive guidance signals from result data
  const guidanceSignals = (() => {
    if (!result) return { topConcerns: [] as string[], topStrengths: [] as string[], riskSummary: undefined as string | undefined };

    // Build a risk summary from the highest-severity risk flag
    const highRisk = (result.riskFlags || []).find(r => r.severity === 'high');
    const riskSummary = highRisk ? highRisk.flag : undefined;

    // Top concerns: combine concerns + weak dimension reasoning
    const concerns = [...(result.concerns || [])];
    const weakDims = (result.dimensions || [])
      .filter(d => d.band === 'WEAK')
      .map(d => d.reasoning);
    const topConcerns = [...concerns, ...weakDims].filter(Boolean);

    // Top strengths from result
    const topStrengths = [...(result.strengths || [])].filter(Boolean);

    return { topConcerns, topStrengths, riskSummary };
  })();

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/dashboard"
            className="text-sm text-muted-foreground hover:text-foreground transition mb-2 inline-block"
          >
            &#8592; Dashboard
          </Link>
          <h1 className="text-xl font-bold">
            {analysis.prTitle || `${analysis.prOwner}/${analysis.prRepo}#${analysis.prNumber}`}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-muted-foreground">
              {analysis.prOwner}/{analysis.prRepo}#{analysis.prNumber}
            </span>
            <Badge variant="secondary" className="text-xs">
              {analysis.mode === 'QUICK' ? 'Quick Scan' : 'Deep Analysis'}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {result?.executiveSummary && (
            <CopySummary
              score={analysis.compositeScore || 0}
              action={result.action || 'NEEDS_HUMAN_JUDGMENT'}
              confidence={analysis.confidenceLevel || 'MODERATE'}
              summary={result.executiveSummary}
              prUrl={analysis.prUrl}
            />
          )}
          <a
            href={analysis.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-foreground transition"
          >
            View on GitHub &#8599;
          </a>
        </div>
      </div>

      {/* Score */}
      <Card>
        <CardContent className="pt-6">
          <ScoreDisplay
            score={analysis.compositeScore || 0}
            confidence={analysis.confidenceLevel || 'MODERATE'}
            priority={result?.priority || 'MEDIUM'}
            action={result?.action || analysis.recommendation || 'NEEDS_HUMAN_JUDGMENT'}
            prCategory={result?.prCategory}
          />
        </CardContent>
      </Card>

      {/* Maintainer Guidance */}
      {result && (
        <MaintainerGuidance
          priority={result.priority || 'MEDIUM'}
          confidence={analysis.confidenceLevel || 'MODERATE'}
          action={result.action || 'NEEDS_HUMAN_JUDGMENT'}
          prCategory={result.prCategory}
          hasConflicts={(result.conflictingSignals || []).length > 0}
          topConcerns={guidanceSignals.topConcerns}
          topStrengths={guidanceSignals.topStrengths}
          riskSummary={guidanceSignals.riskSummary}
        />
      )}

      {/* Executive summary */}
      {result?.executiveSummary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {result.executiveSummary}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Risk flags */}
      {result?.riskFlags && result.riskFlags.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Risk Flags</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {result.riskFlags.map((flag, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <Badge
                    variant={
                      flag.severity === 'high'
                        ? 'danger'
                        : flag.severity === 'medium'
                        ? 'warning'
                        : 'info'
                    }
                    className="mt-0.5"
                  >
                    {flag.severity}
                  </Badge>
                  <div>
                    <span className="font-medium">{flag.flag}</span>
                    {flag.evidence && (
                      <span className="text-muted-foreground ml-1">
                        — {flag.evidence}
                      </span>
                    )}
                    <span className="text-red-400 text-xs ml-2">
                      (-{flag.penalty} pts)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Strengths & Concerns */}
      <div className="grid md:grid-cols-2 gap-4">
        {result?.strengths && result.strengths.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-green-400">Strengths</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {result.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">&#10003;</span>
                    {s}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
        {result?.concerns && result.concerns.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-yellow-400">Concerns</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {result.concerns.map((c, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-yellow-400 mt-0.5">&#9888;</span>
                    {c}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dimensions */}
      {result?.dimensions && result.dimensions.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Dimension Scores</h2>
          <div className="grid gap-3">
            {result.dimensions.map((dim) => (
              <DimensionBand
                key={dim.key}
                name={DIMENSION_LABELS[dim.key] || dim.name}
                band={dim.band}
                weight={dim.weight}
                reasoning={dim.reasoning}
                evidence={dim.evidence}
              />
            ))}
          </div>
        </div>
      )}

      {/* What to verify */}
      {result?.whatToVerify && result.whatToVerify.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">What to Verify</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {result.whatToVerify.map((v, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-muted-foreground/60 mt-0.5">&#8226;</span>
                  {v}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Context status */}
      {result && (
        <ContextStatus
          available={result.availableContext || []}
          missing={result.missingContext || []}
        />
      )}

      {/* Conflicting signals */}
      {result?.conflictingSignals && result.conflictingSignals.length > 0 && (
        <Card className="border-yellow-500/30">
          <CardHeader>
            <CardTitle className="text-base text-yellow-400">
              Conflicting Signals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {result.conflictingSignals.map((s, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-yellow-400 mt-0.5">&#9888;</span>
                  {s}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Feedback */}
      <div className="border-t border-border pt-6">
        <FeedbackButtons analysisId={analysis.id} initialFeedback={userFeedback} />
        <p className="text-xs text-muted-foreground mt-4">
          Probabilistic assessment based on available context. Maintainers make the final call.
        </p>
      </div>
    </div>
  );
}
