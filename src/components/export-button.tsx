'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function ExportButton({
  analysisId,
  tierAllowed,
}: {
  analysisId: string;
  tierAllowed: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (!tierAllowed) {
    return (
      <Button variant="outline" size="sm" disabled title="Upgrade to Pro for exports">
        Export
      </Button>
    );
  }

  return (
    <div className="relative">
      <Button variant="outline" size="sm" onClick={() => setOpen(!open)}>
        Export
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-card border rounded-lg shadow-lg py-1 min-w-[120px]">
            <a
              href={`/api/analyses/${analysisId}/export?format=json`}
              className="block px-4 py-2 text-sm hover:bg-muted transition"
              onClick={() => setOpen(false)}
            >
              JSON
            </a>
            <a
              href={`/api/analyses/${analysisId}/export?format=csv`}
              className="block px-4 py-2 text-sm hover:bg-muted transition"
              onClick={() => setOpen(false)}
            >
              CSV
            </a>
          </div>
        </>
      )}
    </div>
  );
}
