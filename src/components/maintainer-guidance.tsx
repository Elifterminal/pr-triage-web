'use client';

interface MaintainerGuidanceProps {
  priority: string;
  confidence: string;
  action: string;
  prCategory?: string;
  hasConflicts: boolean;
  topConcerns?: string[];
  topStrengths?: string[];
  riskSummary?: string;
}

interface GuidanceOutput {
  statement: string;
  rationale?: string;
}

function pickReason(items: string[], fallback: string): string {
  if (items.length === 0) return fallback;
  const raw = items[0].replace(/\.$/, '');
  // Don't lowercase if it starts with an acronym (e.g. PR, API, SQL)
  if (raw.length >= 2 && raw[0] === raw[0].toUpperCase() && raw[1] === raw[1].toUpperCase()) {
    return raw;
  }
  return raw.charAt(0).toLowerCase() + raw.slice(1);
}

function deriveGuidance({
  priority,
  confidence,
  action,
  prCategory,
  hasConflicts,
  topConcerns,
  topStrengths,
  riskSummary,
}: MaintainerGuidanceProps): GuidanceOutput {
  const concerns = topConcerns || [];
  const strengths = topStrengths || [];

  // === IGNORE: Definitive rejection with cause ===
  if (action === 'IGNORE') {
    const cause = riskSummary || (concerns.length > 0 ? concerns[0] : null);
    if (cause) {
      return {
        statement: `This PR can be safely ignored: ${pickReason([cause], '')}.`,
        rationale: concerns.length > 1 ? concerns.slice(1, 3).join('. ').replace(/\.$/, '') + '.' : undefined,
      };
    }
    return {
      statement: 'This PR does not appear to merit review and can be safely ignored.',
    };
  }

  // === PRIORITIZE: Explain what makes it worth fast-tracking ===
  if (action === 'PRIORITIZE') {
    const why = strengths.length > 0
      ? pickReason(strengths, 'strong implementation with clear issue resolution')
      : 'strong implementation with clear issue resolution';
    return {
      statement: `This PR should be prioritized: ${why}.`,
      rationale: strengths.length > 1 ? strengths.slice(1, 3).join('. ').replace(/\.$/, '') + '.' : undefined,
    };
  }

  // === Special case: trivial docs ===
  if (prCategory === 'DOCS_ONLY') {
    return {
      statement: 'Trivial documentation change — safe to batch or defer.',
      rationale: concerns.length > 0 ? pickReason(concerns, '') + '.' : 'No functional impact on the codebase.',
    };
  }

  // === Special case: formatting/cosmetic ===
  if (prCategory === 'FORMATTING_ONLY' || prCategory === 'COSMETIC_RENAME') {
    return {
      statement: 'Cosmetic change — safe to batch or defer.',
      rationale: 'No functional impact on the codebase.',
    };
  }

  // === NEEDS_HUMAN_JUDGMENT: Explain what's ambiguous ===
  if (action === 'NEEDS_HUMAN_JUDGMENT') {
    if (hasConflicts && concerns.length > 0) {
      return {
        statement: `Signals are mixed — a closer look is recommended: ${pickReason(concerns, 'conflicting quality indicators')}.`,
        rationale: concerns.length > 1 ? concerns.slice(1, 3).join('. ').replace(/\.$/, '') + '.' : undefined,
      };
    }
    if (confidence === 'INSUFFICIENT') {
      return {
        statement: 'Not enough context to assess this PR confidently — human judgment needed.',
        rationale: concerns.length > 0 ? pickReason(concerns, '') + '.' : 'Key context like linked issues or repo patterns is missing.',
      };
    }
    return {
      statement: 'This PR has conflicting signals and warrants a manual review.',
      rationale: concerns.length > 0 ? pickReason(concerns, '') + '.' : undefined,
    };
  }

  // === REVIEW: Explain what's promising but needs verification ===
  if (action === 'REVIEW') {
    if (prCategory === 'DEPENDENCY_BUMP') {
      return {
        statement: 'This dependency update may include security fixes — warrants a prompt review.',
        rationale: concerns.length > 0 ? pickReason(concerns, '') + '.' : undefined,
      };
    }
    const promise = strengths.length > 0
      ? pickReason(strengths, 'meaningful changes')
      : 'meaningful changes';
    const caveat = concerns.length > 0
      ? `, but ${pickReason(concerns, 'some areas need verification')}`
      : '';
    return {
      statement: `Worth reviewing: ${promise}${caveat}.`,
      rationale: concerns.length > 1 ? concerns.slice(1, 3).join('. ').replace(/\.$/, '') + '.' : undefined,
    };
  }

  // === BATCH: Low-impact, explain why it's deferrable ===
  if (action === 'BATCH') {
    if (prCategory === 'DEPENDENCY_BUMP') {
      return {
        statement: 'Routine dependency update — safe to batch with other low-impact changes.',
        rationale: 'Patch-level version bump with no direct code changes.',
      };
    }
    const why = concerns.length > 0
      ? pickReason(concerns, 'limited scope or impact')
      : (strengths.length > 0
        ? `${pickReason(strengths, 'minor improvement')}, but limited overall impact`
        : 'limited scope or impact');
    return {
      statement: `Safe to defer or batch: ${why}.`,
      rationale: concerns.length > 1 ? concerns.slice(1, 3).join('. ').replace(/\.$/, '') + '.' : undefined,
    };
  }

  // Fallback
  return {
    statement: 'Review this change at your discretion.',
    rationale: concerns.length > 0 ? pickReason(concerns, '') + '.' : undefined,
  };
}

export function MaintainerGuidance(props: MaintainerGuidanceProps) {
  const { statement, rationale } = deriveGuidance(props);

  return (
    <div className="rounded-lg border border-border bg-card/50 px-5 py-4">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
        Maintainer Guidance
      </div>
      <p className="text-sm font-medium text-foreground leading-relaxed">
        {statement}
      </p>
      {rationale && (
        <p className="text-xs text-muted-foreground mt-1.5">
          {rationale}
        </p>
      )}
    </div>
  );
}
