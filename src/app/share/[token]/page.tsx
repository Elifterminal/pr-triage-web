import { notFound } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/db';
import { ScoreDisplay } from '@/components/score-display';
import { MaintainerGuidance } from '@/components/maintainer-guidance';
import { DimensionBand } from '@/components/dimension-band';
import { ContextStatus } from '@/components/context-status';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { TriageResult } from '@/engine/types';

const DIMENSION_LABELS: Record<string, string> = {
  issue_fit: 'Issue Resolution Fit',
  substance: 'Implementation Substance',
  pattern_alignment: 'Pattern Alignment',
  scope_match: 'Scope / Complexity Match',
  test_signal: 'Test Signal',
  risk_flags: 'Risk Flags',
};

export default async function SharedAnalysisPage({
  params,
}: {
  params: { token: string };
}) {
  const analysis = await db.analysis.findUnique({
    where: { shareToken: params.token },
  });

  if (!analysis || analysis.status !== 'COMPLETE' || !analysis.resultData) {
    notFound();
  }

  const rawResult = JSON.parse(analysis.resultData as string) as TriageResult;
  const result = {
    ...rawResult,
    action: (rawResult.action as string) === 'IGNORE' ? 'CLOSE' : rawResult.action,
    recommendation: (rawResult.recommendation as string) === 'IGNORE' ? 'CLOSE' : rawResult.recommendation,
  } as TriageResult;

  const guidanceSignals = (() => {
    const highRisk = (result.riskFlags || []).find(r => r.severity === 'high');
    const riskSummary = highRisk ? highRisk.flag : undefined;
    const concerns = [...(result.concerns || [])];
    const weakDims = (result.dimensions || [])
      .filter(d => d.band === 'WEAK')
      .map(d => d.reasoning);
    const topConcerns = [...concerns, ...weakDims].filter(Boolean);
    const topStrengths = [...(result.strengths || [])].filter(Boolean);
    return { topConcerns, topStrengths, riskSummary };
  })();

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div>
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
          <a
            href={analysis.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-foreground transition ml-auto"
          >
            View on GitHub &nearr;
          </a>
        </div>
      </div>

      {/* Score */}
      <Card>
        <CardContent className="pt-6">
          <ScoreDisplay
            score={analysis.compositeScore || 0}
            confidence={analysis.confidenceLevel || 'MODERATE'}
            priority={result.priority || 'MEDIUM'}
            action={result.action || 'NEEDS_HUMAN_JUDGMENT'}
            prCategory={result.prCategory}
          />
        </CardContent>
      </Card>

      {/* Maintainer Guidance */}
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

      {/* Executive summary */}
      {result.executiveSummary && (
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
      {result.riskFlags && result.riskFlags.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Risk Flags</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {result.riskFlags.map((flag, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <Badge
                    variant={flag.severity === 'high' ? 'danger' : flag.severity === 'medium' ? 'warning' : 'info'}
                    className="mt-0.5"
                  >
                    {flag.severity}
                  </Badge>
                  <div>
                    <span className="font-medium">{flag.flag}</span>
                    {flag.evidence && <span className="text-muted-foreground ml-1">— {flag.evidence}</span>}
                    <span className="text-red-400 text-xs ml-2">(-{flag.penalty} pts)</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Strengths & Concerns */}
      <div className="grid md:grid-cols-2 gap-4">
        {result.strengths && result.strengths.length > 0 && (
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
        {result.concerns && result.concerns.length > 0 && (
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
      {result.dimensions && result.dimensions.length > 0 && (
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
      {result.whatToVerify && result.whatToVerify.length > 0 && (
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
      <ContextStatus
        available={result.availableContext || []}
        missing={result.missingContext || []}
      />

      {/* CTA */}
      <div className="border-t border-border pt-6 text-center">
        <p className="text-sm text-muted-foreground mb-3">
          Analyzed by <Link href="/" className="text-foreground hover:underline">PR Triage</Link>
        </p>
        <Link href="/">
          <span className="text-sm text-primary hover:underline">
            Try PR Triage free — analyze your own PRs &rarr;
          </span>
        </Link>
      </div>
    </div>
  );
}
