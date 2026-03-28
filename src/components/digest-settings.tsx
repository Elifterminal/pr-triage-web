'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function DigestSettings({ tierAllowed }: { tierAllowed: boolean }) {
  const [enabled, setEnabled] = useState(false);
  const [frequency, setFrequency] = useState<'DAILY' | 'WEEKLY'>('DAILY');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchPrefs = useCallback(async () => {
    try {
      const res = await fetch('/api/digest');
      const data = await res.json();
      setEnabled(data.enabled);
      setFrequency(data.frequency || 'DAILY');
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPrefs(); }, [fetchPrefs]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await fetch('/api/digest', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, frequency }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  if (!tierAllowed) {
    return (
      <Card className="opacity-60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Triage Digest
            <Badge variant="outline">Pro</Badge>
          </CardTitle>
          <CardDescription>Get a summary of your PR triage activity delivered to your inbox.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Upgrade to Pro or Team to enable digest emails.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Triage Digest</CardTitle>
        <CardDescription>Get a summary of your PR triage activity delivered to your inbox.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Email Digest</p>
                <p className="text-xs text-muted-foreground">
                  Receive a summary of all analyses since your last digest.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                onClick={() => setEnabled(!enabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  enabled ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {enabled && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Frequency</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFrequency('DAILY')}
                    className={`px-4 py-2 rounded-lg border text-sm transition ${
                      frequency === 'DAILY'
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border text-muted-foreground hover:border-muted-foreground'
                    }`}
                  >
                    Daily
                  </button>
                  <button
                    type="button"
                    onClick={() => setFrequency('WEEKLY')}
                    className={`px-4 py-2 rounded-lg border text-sm transition ${
                      frequency === 'WEEKLY'
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border text-muted-foreground hover:border-muted-foreground'
                    }`}
                  >
                    Weekly (Mondays)
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Button onClick={handleSave} disabled={saving} size="sm">
                {saving ? 'Saving...' : 'Save'}
              </Button>
              {saved && (
                <span className="text-sm text-green-400">Saved!</span>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
