'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function ShareButton({
  analysisId,
  existingShareToken,
  tierAllowed,
}: {
  analysisId: string;
  existingShareToken: string | null;
  tierAllowed: boolean;
}) {
  const [shareToken, setShareToken] = useState(existingShareToken);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!tierAllowed) {
    return (
      <Button variant="outline" size="sm" disabled title="Upgrade to Pro for shareable links">
        Share
      </Button>
    );
  }

  async function handleShare() {
    setLoading(true);
    try {
      const res = await fetch(`/api/analyses/${analysisId}/share`, { method: 'POST' });
      const data = await res.json();
      if (data.shareToken) {
        setShareToken(data.shareToken);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke() {
    setLoading(true);
    try {
      await fetch(`/api/analyses/${analysisId}/share`, { method: 'DELETE' });
      setShareToken(null);
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    const url = `${window.location.origin}/share/${shareToken}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (shareToken) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleCopy}>
          {copied ? 'Copied!' : 'Copy Link'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRevoke}
          disabled={loading}
          className="text-red-400 hover:text-red-300"
        >
          Revoke
        </Button>
      </div>
    );
  }

  return (
    <Button variant="outline" size="sm" onClick={handleShare} disabled={loading}>
      {loading ? 'Sharing...' : 'Share'}
    </Button>
  );
}
