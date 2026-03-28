'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Token {
  id: string;
  tokenPrefix: string;
  label: string;
  lastUsedAt: string | null;
  createdAt: string;
}

export function ApiTokens({ tierAllowed }: { tierAllowed: boolean }) {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [label, setLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (tierAllowed) {
      fetch('/api/tokens').then(r => r.json()).then(d => setTokens(d.tokens || [])).catch(() => {});
    }
  }, [tierAllowed]);

  if (!tierAllowed) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">API Access</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            API access is available on the Team plan. Upgrade to use PR Triage from CI/CD pipelines.
          </p>
        </CardContent>
      </Card>
    );
  }

  async function handleCreate() {
    setLoading(true);
    setNewToken(null);
    try {
      const res = await fetch('/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: label || 'API Token' }),
      });
      const data = await res.json();
      if (data.token) {
        setNewToken(data.token);
        setLabel('');
        // Refresh list
        const listRes = await fetch('/api/tokens');
        const listData = await listRes.json();
        setTokens(listData.tokens || []);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke(tokenId: string) {
    await fetch('/api/tokens', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokenId }),
    });
    setTokens(tokens.filter(t => t.id !== tokenId));
  }

  function handleCopy() {
    if (newToken) {
      navigator.clipboard.writeText(newToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">API Tokens</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {newToken && (
          <div className="rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-3 space-y-2">
            <p className="text-sm font-medium text-green-400">
              Token created! Copy it now — you won&apos;t see it again.
            </p>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-muted px-2 py-1 rounded flex-1 overflow-x-auto">
                {newToken}
              </code>
              <Button size="sm" variant="outline" onClick={handleCopy}>
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Input
            placeholder="Token label (e.g., CI/CD)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="flex-1"
          />
          <Button onClick={handleCreate} disabled={loading || tokens.length >= 5}>
            {loading ? 'Creating...' : 'Create Token'}
          </Button>
        </div>

        {tokens.length > 0 && (
          <div className="space-y-2">
            {tokens.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                <div>
                  <span className="text-sm font-medium">{t.label}</span>
                  <span className="text-xs text-muted-foreground ml-2">{t.tokenPrefix}</span>
                  {t.lastUsedAt && (
                    <span className="text-xs text-muted-foreground ml-2">
                      Last used {new Date(t.lastUsedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-400 hover:text-red-300"
                  onClick={() => handleRevoke(t.id)}
                >
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="text-xs text-muted-foreground space-y-1">
          <p>Use your token with the API:</p>
          <code className="block bg-muted px-2 py-1 rounded text-xs">
            curl -H &quot;Authorization: Bearer pt_...&quot; -X POST https://pr-triage-web.vercel.app/api/analyze -d &apos;{'{'}&#34;prUrl&#34;:&#34;https://github.com/owner/repo/pull/1&#34;{'}'}  &apos;
          </code>
        </div>
      </CardContent>
    </Card>
  );
}
