'use client';

import { useState } from 'react';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';

interface FeedbackButtonsProps {
  analysisId: string;
  initialFeedback?: 'AGREE' | 'DISAGREE' | null;
}

export function FeedbackButtons({ analysisId, initialFeedback }: FeedbackButtonsProps) {
  const [feedback, setFeedback] = useState<string | null>(initialFeedback || null);
  const [loading, setLoading] = useState(false);

  async function submitFeedback(type: 'AGREE' | 'DISAGREE') {
    if (loading) return;
    setLoading(true);

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysisId, feedbackType: type }),
      });

      if (res.ok) {
        setFeedback(type);
      }
    } catch {
      // Silently fail — feedback is non-critical
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground">Was this assessment helpful?</span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => submitFeedback('AGREE')}
          disabled={loading}
          className={cn(
            feedback === 'AGREE' && 'border-green-500 bg-green-500/10 text-green-400'
          )}
        >
          &#128077; Agree
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => submitFeedback('DISAGREE')}
          disabled={loading}
          className={cn(
            feedback === 'DISAGREE' && 'border-red-500 bg-red-500/10 text-red-400'
          )}
        >
          &#128078; Disagree
        </Button>
      </div>
    </div>
  );
}
