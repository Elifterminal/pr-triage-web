'use client';

import { useState } from 'react';
import { Button } from './ui/button';

interface CopySummaryProps {
  score: number;
  action: string;
  confidence: string;
  summary: string;
  prUrl: string;
}

export function CopySummary({ score, action, confidence, summary, prUrl }: CopySummaryProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const text = [
      `PR Triage: ${score}/100 — ${action} (${confidence} confidence)`,
      summary,
      prUrl,
    ].join('\n');

    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button variant="outline" size="sm" onClick={handleCopy}>
      {copied ? 'Copied!' : 'Copy Summary'}
    </Button>
  );
}
