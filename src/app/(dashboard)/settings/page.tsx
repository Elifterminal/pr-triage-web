'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface TierInfo {
  plan: string;
  label: string;
  limits: {
    dailyAnalyses: number;
    deepAnalysis: boolean;
    shareableLinks: boolean;
    connectedRepos: number;
    exportResults: boolean;
    apiAccess: boolean;
  };
  usage: {
    todayCount: number;
    remaining: number | null;
  };
}

interface ApiKeyInfo {
  id: string;
  provider: string;
  label: string | null;
  isValid: boolean;
  lastTestedAt: string | null;
  createdAt: string;
}

const PROVIDERS = [
  { value: 'ANTHROPIC', label: 'Anthropic', placeholder: 'sk-ant-api03-...' },
  { value: 'OPENAI', label: 'OpenAI', placeholder: 'sk-...' },
  { value: 'OPENROUTER', label: 'OpenRouter', placeholder: 'sk-or-v1-...' },
] as const;

export default function SettingsPage() {
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<TierInfo | null>(null);

  // Add key form state
  const [selectedProvider, setSelectedProvider] = useState('ANTHROPIC');
  const [apiKeyValue, setApiKeyValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Delete state
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch('/api/keys');
      if (res.ok) {
        const data = await res.json();
        setKeys(data);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
    fetch('/api/user/tier').then(r => r.json()).then(setTier).catch(() => {});
  }, [fetchKeys]);

  async function handleSaveKey(e: React.FormEvent) {
    e.preventDefault();
    if (!apiKeyValue.trim() || saving) return;

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          apiKey: apiKeyValue.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save key');
      }

      if (!data.isValid) {
        setSaveError('Key saved but validation failed. Check that the key is correct and has sufficient permissions.');
      } else {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }

      setApiKeyValue('');
      fetchKeys();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save key');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteKey(id: string) {
    setDeleting(id);
    try {
      await fetch(`/api/keys?id=${id}`, { method: 'DELETE' });
      fetchKeys();
    } catch {
      // Silently fail
    } finally {
      setDeleting(null);
    }
  }

  const currentProvider = PROVIDERS.find((p) => p.value === selectedProvider)!;

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage your API keys and preferences.
        </p>
      </div>

      {/* Plan */}
      {tier && (
        <Card>
          <CardHeader>
            <CardTitle>Plan</CardTitle>
            <CardDescription>Your current subscription tier and feature access.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold">{tier.label}</span>
                {tier.plan === 'FREE' && (
                  <Badge variant="secondary">Free</Badge>
                )}
                {tier.plan === 'PRO' && (
                  <Badge variant="info">Pro</Badge>
                )}
                {tier.plan === 'TEAM' && (
                  <Badge variant="success">Team</Badge>
                )}
              </div>
              {tier.plan === 'FREE' && (
                <Button size="sm" variant="outline" disabled>Upgrade (coming soon)</Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
              <div className="flex items-center gap-2">
                <span className={tier.limits.dailyAnalyses === 0 ? 'text-green-400' : 'text-muted-foreground'}>
                  {tier.limits.dailyAnalyses === 0 ? '\u2713' : `${tier.limits.dailyAnalyses}/day`}
                </span>
                <span className="text-muted-foreground">
                  {tier.limits.dailyAnalyses === 0 ? 'Unlimited analyses' : 'Daily analyses'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={tier.limits.deepAnalysis ? 'text-green-400' : 'text-muted-foreground'}>
                  {tier.limits.deepAnalysis ? '\u2713' : '\u2717'}
                </span>
                <span className="text-muted-foreground">Deep Analysis</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={tier.limits.shareableLinks ? 'text-green-400' : 'text-muted-foreground'}>
                  {tier.limits.shareableLinks ? '\u2713' : '\u2717'}
                </span>
                <span className="text-muted-foreground">Shareable links</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={tier.limits.exportResults ? 'text-green-400' : 'text-muted-foreground'}>
                  {tier.limits.exportResults ? '\u2713' : '\u2717'}
                </span>
                <span className="text-muted-foreground">Export results</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={tier.limits.connectedRepos > 0 ? 'text-green-400' : 'text-muted-foreground'}>
                  {tier.limits.connectedRepos > 0 ? '\u2713' : '\u2717'}
                </span>
                <span className="text-muted-foreground">
                  {tier.limits.connectedRepos > 0
                    ? `${tier.limits.connectedRepos >= 999 ? 'Unlimited' : tier.limits.connectedRepos} connected repos`
                    : 'Auto PR ingestion'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={tier.limits.apiAccess ? 'text-green-400' : 'text-muted-foreground'}>
                  {tier.limits.apiAccess ? '\u2713' : '\u2717'}
                </span>
                <span className="text-muted-foreground">API access</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current keys */}
      <Card>
        <CardHeader>
          <CardTitle>API Keys</CardTitle>
          <CardDescription>
            Your keys are encrypted with AES-256-GCM and never shared.
            We only use them to call the LLM API on your behalf during analysis.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : keys.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No API keys configured. Add one below to start analyzing PRs.
            </p>
          ) : (
            <div className="space-y-3">
              {keys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{key.provider}</span>
                        <Badge variant={key.isValid ? 'success' : 'danger'}>
                          {key.isValid ? 'Valid' : 'Invalid'}
                        </Badge>
                      </div>
                      {key.lastTestedAt && (
                        <span className="text-xs text-muted-foreground">
                          Last tested: {new Date(key.lastTestedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteKey(key.id)}
                    disabled={deleting === key.id}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  >
                    {deleting === key.id ? 'Removing...' : 'Remove'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add key */}
      <Card>
        <CardHeader>
          <CardTitle>Add API Key</CardTitle>
          <CardDescription>
            Bring your own key. We test it against the provider API before saving.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveKey} className="space-y-4">
            {/* Provider selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Provider</label>
              <div className="flex gap-2">
                {PROVIDERS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setSelectedProvider(p.value)}
                    className={`px-4 py-2 rounded-lg border text-sm transition ${
                      selectedProvider === p.value
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border text-muted-foreground hover:border-muted-foreground'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Key input */}
            <div className="space-y-2">
              <label className="text-sm font-medium">API Key</label>
              <Input
                type="password"
                placeholder={currentProvider.placeholder}
                value={apiKeyValue}
                onChange={(e) => setApiKeyValue(e.target.value)}
                disabled={saving}
              />
            </div>

            {saveError && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-400">
                {saveError}
              </div>
            )}

            {saveSuccess && (
              <div className="rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-3 text-sm text-green-400">
                API key saved and validated successfully.
              </div>
            )}

            <Button type="submit" disabled={saving || !apiKeyValue.trim()}>
              {saving ? 'Testing & Saving...' : 'Save Key'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Info */}
      <div className="rounded-lg border bg-card p-6 space-y-3">
        <h3 className="font-medium text-sm">How your keys are handled</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="text-green-400 mt-0.5">{'\u2713'}</span>
            Encrypted at rest with AES-256-GCM
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-400 mt-0.5">{'\u2713'}</span>
            Only decrypted server-side at analysis time
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-400 mt-0.5">{'\u2713'}</span>
            Never sent to any third party except the chosen LLM provider
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-400 mt-0.5">{'\u2713'}</span>
            You can remove your key at any time
          </li>
        </ul>
      </div>
    </div>
  );
}
