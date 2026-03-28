'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Repo {
  id: string;
  owner: string;
  repo: string;
  isActive: boolean;
  createdAt: string;
}

export function ConnectedRepos({
  tierAllowed,
  maxRepos,
}: {
  tierAllowed: boolean;
  maxRepos: number;
}) {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [repoUrl, setRepoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tierAllowed) {
      fetch('/api/repos').then(r => r.json()).then(d => setRepos(d.repos || [])).catch(() => {});
    }
  }, [tierAllowed]);

  if (!tierAllowed) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connected Repos</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Auto-analyze PRs when they&apos;re opened. Available on Pro and Team plans.
          </p>
        </CardContent>
      </Card>
    );
  }

  function parseRepoUrl(input: string): { owner: string; repo: string } | null {
    // Accept "owner/repo" or full GitHub URL
    const urlMatch = input.match(/github\.com\/([\w.-]+)\/([\w.-]+)/);
    if (urlMatch) return { owner: urlMatch[1], repo: urlMatch[2] };
    const slashMatch = input.match(/^([\w.-]+)\/([\w.-]+)$/);
    if (slashMatch) return { owner: slashMatch[1], repo: slashMatch[2] };
    return null;
  }

  async function handleConnect() {
    const parsed = parseRepoUrl(repoUrl.trim());
    if (!parsed) {
      setError('Enter a repo as owner/repo or a GitHub URL');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/repos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to connect');
      setRepos(prev => [data.repo, ...prev]);
      setRepoUrl('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setLoading(false);
    }
  }

  async function handleDisconnect(id: string) {
    try {
      await fetch(`/api/repos/${id}`, { method: 'DELETE' });
      setRepos(repos.filter(r => r.id !== id));
    } catch {
      // silently fail
    }
  }

  const limitLabel = maxRepos >= 999 ? 'unlimited' : `${maxRepos}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Connected Repos
          <span className="text-xs text-muted-foreground font-normal ml-2">
            {repos.length}/{limitLabel}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Input
            placeholder="owner/repo or GitHub URL"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            className="flex-1"
            onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
          />
          <Button
            onClick={handleConnect}
            disabled={loading || !repoUrl.trim() || repos.length >= maxRepos}
          >
            {loading ? 'Connecting...' : 'Connect'}
          </Button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {repos.length > 0 && (
          <div className="space-y-2">
            {repos.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{r.owner}/{r.repo}</span>
                  <Badge variant={r.isActive ? 'success' : 'secondary'} className="text-xs">
                    {r.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-400 hover:text-red-300"
                  onClick={() => handleDisconnect(r.id)}
                >
                  Disconnect
                </Button>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          When a PR is opened on a connected repo, PR Triage automatically runs a Quick Scan.
          You need admin access to the repo for webhook creation. Only public repos are supported.
        </p>
      </CardContent>
    </Card>
  );
}
