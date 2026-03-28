'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BatchInput } from '@/components/batch-input';

type AnalysisState = 'idle' | 'validating' | 'fetching' | 'evaluating' | 'done' | 'error';

interface TierInfo {
  plan: string;
  label: string;
  limits: {
    dailyAnalyses: number;
    deepAnalysis: boolean;
    batchAnalysis: boolean;
  };
  usage: {
    todayCount: number;
    remaining: number | null;
  };
}

const STEPS: Record<AnalysisState, { label: string; progress: number }> = {
  idle: { label: '', progress: 0 },
  validating: { label: 'Validating PR URL...', progress: 10 },
  fetching: { label: 'Fetching PR data from GitHub...', progress: 35 },
  evaluating: { label: 'AI is evaluating the pull request...', progress: 65 },
  done: { label: 'Analysis complete. Redirecting...', progress: 100 },
  error: { label: '', progress: 0 },
};

export default function AnalyzePage() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [mode, setMode] = useState<'QUICK' | 'DEEP'>('QUICK');
  const [inputMode, setInputMode] = useState<'single' | 'batch'>('single');
  const [state, setState] = useState<AnalysisState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [tier, setTier] = useState<TierInfo | null>(null);

  useEffect(() => {
    fetch('/api/user/tier').then(r => r.json()).then(setTier).catch(() => {});
  }, []);

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || state !== 'idle') return;

    setError(null);
    setState('validating');

    // Basic URL validation
    const prPattern = /^https?:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+/;
    if (!prPattern.test(url.trim())) {
      setError('Invalid PR URL. Expected: https://github.com/owner/repo/pull/123');
      setState('idle');
      return;
    }

    setState('fetching');

    try {
      const fetchTimer = setTimeout(() => setState('evaluating'), 3000);

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prUrl: url.trim(), mode }),
      });

      clearTimeout(fetchTimer);

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Analysis failed');
      }

      const data = await res.json();
      setState('done');

      setTimeout(() => router.push(`/analysis/${data.id}`), 500);
    } catch (err) {
      setState('idle');
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  const isProcessing = state !== 'idle' && state !== 'error';
  const step = STEPS[state];
  const tierLoading = tier === null;
  const canDeep = tier?.limits.deepAnalysis ?? false;
  const canBatch = tier?.limits.batchAnalysis ?? false;
  const atLimit = tier?.usage.remaining === 0;

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analyze a Pull Request</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Paste a GitHub PR URL to get a structured triage assessment.
          </p>
        </div>
        {canBatch && (
          <div className="flex rounded-lg border border-border overflow-hidden text-sm">
            <button
              type="button"
              onClick={() => setInputMode('single')}
              className={`px-3 py-1.5 transition ${inputMode === 'single' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            >
              Single
            </button>
            <button
              type="button"
              onClick={() => setInputMode('batch')}
              className={`px-3 py-1.5 transition ${inputMode === 'batch' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            >
              Batch
            </button>
          </div>
        )}
      </div>

      {/* Daily limit warning */}
      {atLimit && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="text-2xl">&#9888;</div>
              <div>
                <h3 className="font-semibold mb-1">Daily limit reached</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  You&apos;ve used all {tier?.limits.dailyAnalyses} analyses for today.
                  Upgrade to Pro for unlimited analyses.
                </p>
                <Button size="sm" variant="outline" disabled>Upgrade (coming soon)</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {inputMode === 'batch' && canBatch ? (
        <BatchInput mode={mode} />
      ) : (
      <Card>
        <CardHeader>
          <CardTitle>PR URL</CardTitle>
          <CardDescription>
            Public GitHub pull request URLs are supported. We fetch the diff,
            linked issue, and repo context automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAnalyze} className="space-y-4">
            <Input
              placeholder="https://github.com/owner/repo/pull/123"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isProcessing || atLimit}
              className="text-base"
            />

            {/* Mode selector */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMode('QUICK')}
                className={`flex-1 rounded-lg border px-4 py-3 text-left transition ${
                  mode === 'QUICK'
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-muted-foreground/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Quick Scan</span>
                  <Badge variant="secondary" className="text-xs">Free</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Fast evaluation of core dimensions
                </p>
              </button>
              <button
                type="button"
                onClick={() => canDeep ? setMode('DEEP') : undefined}
                className={`flex-1 rounded-lg border px-4 py-3 text-left transition ${
                  mode === 'DEEP'
                    ? 'border-primary bg-primary/10'
                    : tierLoading
                      ? 'border-border opacity-50 cursor-wait'
                      : canDeep
                        ? 'border-border hover:border-muted-foreground/30'
                        : 'border-border opacity-50 cursor-not-allowed'
                }`}
                disabled={tierLoading || !canDeep}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Deep Analysis</span>
                  <Badge variant="info" className="text-xs">Pro</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {tierLoading
                    ? 'Loading...'
                    : canDeep
                      ? 'Extended context, multi-file reasoning'
                      : 'Upgrade to Pro to unlock'}
                </p>
              </button>
            </div>

            {/* Usage indicator */}
            {tier && tier.usage.remaining !== null && !atLimit && (
              <p className="text-xs text-muted-foreground">
                {tier.usage.remaining} of {tier.limits.dailyAnalyses} analyses remaining today
              </p>
            )}

            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {isProcessing && (
              <div className="space-y-2">
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${step.progress}%` }}
                  />
                </div>
                <p className="text-sm text-muted-foreground">{step.label}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isProcessing || !url.trim() || atLimit}
            >
              {isProcessing ? 'Analyzing...' : `Analyze PR${mode === 'DEEP' ? ' (Deep)' : ''}`}
            </Button>
          </form>
        </CardContent>
      </Card>
      )}

      {/* Tips */}
      <div className="rounded-lg border bg-card p-6 space-y-3">
        <h3 className="font-medium text-sm">Tips for best results</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="text-muted-foreground/60 mt-0.5">&#8226;</span>
            PRs that reference issues (Fixes #123) get more accurate assessments
          </li>
          <li className="flex items-start gap-2">
            <span className="text-muted-foreground/60 mt-0.5">&#8226;</span>
            Repos with CONTRIBUTING.md improve pattern alignment scoring
          </li>
          <li className="flex items-start gap-2">
            <span className="text-muted-foreground/60 mt-0.5">&#8226;</span>
            Very large diffs (&gt;12k chars) are truncated. Key files are prioritized.
          </li>
        </ul>
      </div>
    </div>
  );
}
