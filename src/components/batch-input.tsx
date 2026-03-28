'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface BatchResult {
  url: string;
  id?: string;
  error?: string;
  cached?: boolean;
}

export function BatchInput({ mode }: { mode: 'QUICK' | 'DEEP' }) {
  const router = useRouter();
  const [urls, setUrls] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BatchResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const urlList = urls
    .split('\n')
    .map(u => u.trim())
    .filter(Boolean);

  async function handleBatch(e: React.FormEvent) {
    e.preventDefault();
    if (urlList.length === 0 || loading) return;

    setError(null);
    setResults(null);
    setLoading(true);
    setProgress(10);

    const progressInterval = setInterval(() => {
      setProgress(p => Math.min(p + 5, 90));
    }, 3000);

    try {
      const res = await fetch('/api/analyze/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prUrls: urlList, mode }),
      });

      clearInterval(progressInterval);

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Batch analysis failed');
      }

      const data = await res.json();
      setResults(data.results);
      setProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      clearInterval(progressInterval);
      setLoading(false);
    }
  }

  const successCount = results?.filter(r => r.id && !r.error).length || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Batch Analysis</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleBatch} className="space-y-4">
          <textarea
            className="w-full h-40 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
            placeholder={`Paste PR URLs, one per line (max 10)\nhttps://github.com/owner/repo/pull/1\nhttps://github.com/owner/repo/pull/2`}
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
            disabled={loading}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {urlList.length} PR{urlList.length !== 1 ? 's' : ''} queued
              {urlList.length > 10 && ' (max 10)'}
            </span>
            <Button
              type="submit"
              disabled={loading || urlList.length === 0 || urlList.length > 10}
            >
              {loading ? 'Analyzing...' : `Analyze ${urlList.length} PR${urlList.length !== 1 ? 's' : ''}`}
            </Button>
          </div>

          {loading && (
            <div className="space-y-2">
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Analyzing {urlList.length} PRs... this may take a minute.
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {results && (
            <div className="space-y-3">
              <p className="text-sm font-medium">
                {successCount} of {results.length} completed successfully
              </p>
              <div className="space-y-2">
                {results.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                  >
                    <span className="truncate max-w-[60%] text-muted-foreground">
                      {r.url.replace('https://github.com/', '')}
                    </span>
                    {r.error ? (
                      <span className="text-red-400 text-xs">{r.error}</span>
                    ) : r.id ? (
                      <button
                        type="button"
                        onClick={() => router.push(`/analysis/${r.id}`)}
                        className="text-primary text-xs hover:underline"
                      >
                        View {r.cached ? '(cached)' : ''}
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
