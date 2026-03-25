'use client';

interface ContextStatusProps {
  available: string[];
  missing: string[];
}

export function ContextStatus({ available, missing }: ContextStatusProps) {
  if (available.length === 0 && missing.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h4 className="text-sm font-medium mb-3">Context Status</h4>
      <div className="space-y-1.5 text-sm">
        {available.map((item, i) => (
          <div key={`a-${i}`} className="flex items-center gap-2">
            <span className="text-green-400">&#10003;</span>
            <span className="text-muted-foreground">{item}</span>
          </div>
        ))}
        {missing.map((item, i) => (
          <div key={`m-${i}`} className="flex items-center gap-2">
            <span className="text-red-400">&#10007;</span>
            <span className="text-muted-foreground">{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
