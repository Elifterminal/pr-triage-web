'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const DIMENSION_LABELS: Record<string, string> = {
  issue_fit: 'Issue Resolution Fit',
  substance: 'Implementation Substance',
  pattern_alignment: 'Pattern Alignment',
  scope_match: 'Scope / Complexity Match',
  test_signal: 'Test Signal',
  risk_flags: 'Risk Flags',
};

const DIMENSION_ORDER = [
  'issue_fit', 'substance', 'pattern_alignment',
  'scope_match', 'test_signal', 'risk_flags',
];

export function CustomRules({ tierAllowed }: { tierAllowed: boolean }) {
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [defaults, setDefaults] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tierAllowed) {
      fetch('/api/rules')
        .then(r => r.json())
        .then(d => {
          setWeights(d.dimensionWeights || {});
          setDefaults(d.defaults || {});
        })
        .catch(() => {});
    }
  }, [tierAllowed]);

  if (!tierAllowed) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Custom Scoring Rules</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Custom dimension weights are available on the Team plan. Tune how PR Triage scores your PRs.
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalPercent = Math.round(
    Object.values(weights).reduce((a, b) => a + b, 0) * 100
  );

  function handleSlider(key: string, pct: number) {
    setWeights(prev => ({ ...prev, [key]: pct / 100 }));
    setSaved(false);
  }

  async function handleSave() {
    if (Math.abs(totalPercent - 100) > 1) {
      setError('Weights must total 100%');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dimensionWeights: weights }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    setSaving(true);
    try {
      const res = await fetch('/api/rules', { method: 'DELETE' });
      const data = await res.json();
      setWeights(data.defaults || defaults);
      setSaved(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Custom Scoring Rules</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Adjust how much each dimension contributes to the composite score. Weights must total 100%.
        </p>

        <div className="space-y-3">
          {DIMENSION_ORDER.map(key => {
            const pct = Math.round((weights[key] || 0) * 100);
            return (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>{DIMENSION_LABELS[key]}</span>
                  <span className="text-muted-foreground w-12 text-right">{pct}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={pct}
                  onChange={(e) => handleSlider(key, parseInt(e.target.value))}
                  className="w-full h-1.5 rounded-full appearance-none bg-muted cursor-pointer accent-primary"
                />
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className={totalPercent === 100 ? 'text-green-400' : 'text-yellow-400'}>
            Total: {totalPercent}%
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={handleReset} disabled={saving}>
              Reset to Defaults
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving || Math.abs(totalPercent - 100) > 1}>
              {saving ? 'Saving...' : saved ? 'Saved!' : 'Save'}
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
