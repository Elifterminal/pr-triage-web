'use client';

import { cn } from '@/lib/utils';
import { Badge } from './ui/badge';

interface ScoreDisplayProps {
  score: number;
  confidence: string;
  priority: string;
  action: string;
  prCategory?: string;
}

const ACTION_CONFIG: Record<string, {
  label: string;
  badgeVariant: 'success' | 'warning' | 'danger' | 'info' | 'secondary';
}> = {
  PRIORITIZE: { label: 'Merge', badgeVariant: 'success' },
  REVIEW: { label: 'Review', badgeVariant: 'info' },
  BATCH: { label: 'Low Priority', badgeVariant: 'secondary' },
  CLOSE: { label: 'Close', badgeVariant: 'danger' },
  NEEDS_HUMAN_JUDGMENT: { label: 'Needs Human Judgment', badgeVariant: 'warning' },
};

const PRIORITY_CONFIG: Record<string, {
  label: string;
  variant: 'success' | 'warning' | 'danger' | 'info' | 'secondary';
}> = {
  HIGH: { label: 'High Priority', variant: 'success' },
  MEDIUM: { label: 'Medium Priority', variant: 'info' },
  LOW: { label: 'Low Priority', variant: 'secondary' },
};

const CONFIDENCE_CONFIG: Record<string, {
  label: string;
  variant: 'success' | 'warning' | 'danger' | 'info' | 'secondary';
}> = {
  HIGH: { label: 'High Confidence', variant: 'success' },
  MODERATE: { label: 'Moderate Confidence', variant: 'info' },
  LOW: { label: 'Low Confidence', variant: 'warning' },
  INSUFFICIENT: { label: 'Insufficient Data', variant: 'danger' },
};

const CATEGORY_LABELS: Record<string, string> = {
  DOCS_ONLY: 'Docs Only',
  DEPENDENCY_BUMP: 'Dependency Bump',
  FORMATTING_ONLY: 'Formatting Only',
  COSMETIC_RENAME: 'Cosmetic Rename',
  CODE_CHANGE: 'Code Change',
};

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-blue-400';
  if (score >= 40) return 'text-yellow-400';
  return 'text-red-400';
}

function getScoreBarColor(score: number): string {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-blue-500';
  if (score >= 40) return 'bg-yellow-500';
  return 'bg-red-500';
}

export function ScoreDisplay({ score, confidence, priority, action, prCategory }: ScoreDisplayProps) {
  const actionConfig = ACTION_CONFIG[action] || ACTION_CONFIG.NEEDS_HUMAN_JUDGMENT;
  const priorityConfig = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.MEDIUM;
  const confConfig = CONFIDENCE_CONFIG[confidence] || CONFIDENCE_CONFIG.MODERATE;
  const categoryLabel = prCategory ? CATEGORY_LABELS[prCategory] : null;

  return (
    <div className="space-y-4">
      {/* Score */}
      <div className="flex items-end gap-3">
        <span className={cn('text-5xl font-bold tabular-nums', getScoreColor(score))}>
          {score}
        </span>
        <span className="text-2xl text-muted-foreground mb-1">/100</span>
      </div>

      {/* Score bar */}
      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', getScoreBarColor(score))}
          style={{ width: `${score}%` }}
        />
      </div>

      {/* Three-axis badges */}
      <div className="flex flex-wrap gap-2">
        <Badge variant={actionConfig.badgeVariant} className="text-sm px-3 py-1">
          {actionConfig.label}
        </Badge>
        <Badge variant={priorityConfig.variant} className="text-sm px-3 py-1">
          {priorityConfig.label}
        </Badge>
        <Badge variant={confConfig.variant} className="text-sm px-3 py-1">
          {confConfig.label}
        </Badge>
        {categoryLabel && categoryLabel !== 'Code Change' && (
          <Badge variant="outline" className="text-sm px-3 py-1">
            {categoryLabel}
          </Badge>
        )}
      </div>
    </div>
  );
}
