'use client';

import { cn } from '@/lib/utils';

interface DimensionBandProps {
  name: string;
  band: string;
  weight: number;
  reasoning: string;
  evidence: string[];
}

const BAND_CONFIG: Record<string, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  STRONG: {
    label: 'Strong',
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
  },
  MODERATE: {
    label: 'Moderate',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
  },
  WEAK: {
    label: 'Weak',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
  },
  INSUFFICIENT_DATA: {
    label: 'N/A',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/30',
    borderColor: 'border-muted',
  },
};

export function DimensionBand({ name, band, weight, reasoning, evidence }: DimensionBandProps) {
  const config = BAND_CONFIG[band] || BAND_CONFIG.MODERATE;

  return (
    <div className={cn('rounded-lg border p-4', config.bgColor, config.borderColor)}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-sm">{name}</h4>
          <span className="text-xs text-muted-foreground">({Math.round(weight * 100)}%)</span>
        </div>
        <span className={cn('text-sm font-semibold', config.color)}>
          {config.label}
        </span>
      </div>

      <p className="text-sm text-muted-foreground mb-2">{reasoning}</p>

      {evidence.length > 0 && (
        <div className="space-y-1">
          {evidence.map((e, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
              <span className="text-muted-foreground/60 mt-0.5">&#8226;</span>
              <span className="font-mono">{e}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
