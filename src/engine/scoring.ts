import {
  Action,
  Band,
  BAND_SCORES,
  ConfidenceLevel,
  DimensionKey,
  DimensionResult,
  FileAnalysis,
  MaintainabilityAssessment,
  PRCategory,
  Priority,
  RiskFlag,
  SecurityReview,
  TriageResult,
} from './types';

const DIMENSION_WEIGHTS: Record<DimensionKey, number> = {
  issue_fit: 0.30,
  substance: 0.25,
  pattern_alignment: 0.15,
  scope_match: 0.15,
  test_signal: 0.10,
  risk_flags: 0.05,
};

const DIMENSION_NAMES: Record<DimensionKey, string> = {
  issue_fit: 'Issue Resolution Fit',
  substance: 'Implementation Substance',
  pattern_alignment: 'Repository Pattern Alignment',
  scope_match: 'Scope / Complexity Match',
  test_signal: 'Test Signal',
  risk_flags: 'Risk Flags',
};

interface RawLLMResponse {
  executive_summary: string;
  dimensions: Record<string, {
    band: string;
    reasoning: string;
    evidence: string[];
  }>;
  risk_flags_detail: Array<{
    flag: string;
    severity: string;
    evidence: string;
  }>;
  conflicting_signals: string[];
  strengths: string[];
  concerns: string[];
  what_to_verify: string[];
  missing_context: string[];
  available_context: string[];
}

function parseBand(raw: string): Band {
  const normalized = raw.toUpperCase().replace(/\s+/g, '_');
  if (['STRONG', 'MODERATE', 'WEAK', 'INSUFFICIENT_DATA'].includes(normalized)) {
    return normalized as Band;
  }
  return 'MODERATE';
}

function parseSeverity(raw: string): 'low' | 'medium' | 'high' {
  const normalized = raw.toLowerCase();
  if (['low', 'medium', 'high'].includes(normalized)) {
    return normalized as 'low' | 'medium' | 'high';
  }
  return 'medium';
}

// ============================================
// PR Category Detection
// ============================================

function detectPRCategory(dimensions: DimensionResult[], riskFlags: RiskFlag[]): PRCategory {
  const substance = dimensions.find(d => d.key === 'substance');
  const riskDim = dimensions.find(d => d.key === 'risk_flags');

  // Check evidence and reasoning for category signals
  const allEvidence = dimensions.flatMap(d => [...d.evidence, d.reasoning]).join(' ').toLowerCase();
  const allRiskEvidence = riskFlags.map(r => `${r.flag} ${r.evidence}`).join(' ').toLowerCase();

  // Docs-only: weak substance + mentions readme/docs/typo/documentation
  const docsSignals = ['readme', 'documentation', 'typo', 'docs/', '.md', 'comment', 'spelling'];
  const isDocsOnly = substance?.band === 'WEAK' &&
    docsSignals.some(s => allEvidence.includes(s));

  if (isDocsOnly) return 'DOCS_ONLY';

  // Dependency bump: mentions dependabot, version bump, package.json, lock file
  const depSignals = ['dependabot', 'dependency', 'bump', 'version bump', 'package.json', 'yarn.lock', 'package-lock'];
  const isDepBump = depSignals.some(s => allEvidence.includes(s) || allRiskEvidence.includes(s));
  if (isDepBump && substance?.band !== 'STRONG') return 'DEPENDENCY_BUMP';

  // Formatting only: mentions whitespace, formatting, linting
  const formatSignals = ['whitespace', 'formatting', 'lint', 'indent', 'prettier', 'eslint'];
  const isFormatting = substance?.band === 'WEAK' &&
    formatSignals.some(s => allEvidence.includes(s));
  if (isFormatting) return 'FORMATTING_ONLY';

  // Cosmetic rename
  const renameSignals = ['rename', 'cosmetic', 'no behavioral', 'no functional'];
  const isRename = substance?.band === 'WEAK' &&
    renameSignals.some(s => allEvidence.includes(s));
  if (isRename) return 'COSMETIC_RENAME';

  return 'CODE_CHANGE';
}

// ============================================
// Confidence: How sure the system is
// ============================================

function calculateConfidence(
  dimensions: DimensionResult[],
  missingContext: string[],
  category: PRCategory
): ConfidenceLevel {
  const insufficientCount = dimensions.filter(
    (d) => d.band === 'INSUFFICIENT_DATA'
  ).length;

  // For trivial/obvious PR categories, missing context matters less
  const isTrivialCategory = ['DOCS_ONLY', 'FORMATTING_ONLY', 'COSMETIC_RENAME'].includes(category);
  const isRoutineCategory = ['DEPENDENCY_BUMP'].includes(category);

  if (isTrivialCategory) {
    // Trivial PRs are easy to assess even with missing context.
    // A docs typo fix is unambiguous regardless of missing issue links.
    if (insufficientCount >= 4) return 'MODERATE';
    return 'HIGH';
  }

  if (isRoutineCategory) {
    // Dep bumps are fairly assessable even without linked issues
    if (insufficientCount >= 3) return 'LOW';
    if (insufficientCount >= 1) return 'MODERATE';
    return 'HIGH';
  }

  // Code changes: missing context genuinely reduces confidence
  const missingCount = missingContext.length;
  if (insufficientCount >= 3 || missingCount >= 4) return 'INSUFFICIENT';
  if (insufficientCount >= 2 || missingCount >= 3) return 'LOW';
  if (insufficientCount >= 1 || missingCount >= 2) return 'MODERATE';
  return 'HIGH';
}

// ============================================
// Priority: How much maintainer attention this deserves
// ============================================

function calculatePriority(
  compositeScore: number,
  category: PRCategory,
  hasConflicts: boolean
): Priority {
  // Trivial categories are always low priority regardless of score
  if (['DOCS_ONLY', 'FORMATTING_ONLY', 'COSMETIC_RENAME'].includes(category)) {
    return 'LOW';
  }

  // Dep bumps: low unless they include security fixes (indicated by higher score)
  if (category === 'DEPENDENCY_BUMP') {
    if (compositeScore >= 80) return 'MEDIUM'; // Likely has security implications
    return 'LOW';
  }

  // Code changes: priority based on score and conflict signals
  if (compositeScore >= 80 && !hasConflicts) return 'HIGH';
  if (compositeScore >= 80 && hasConflicts) return 'HIGH'; // Still high but needs judgment
  if (compositeScore >= 60) return 'MEDIUM';
  if (compositeScore >= 40) return 'LOW';
  return 'LOW';
}

// ============================================
// Action: What the maintainer should do
// ============================================

// ============================================
// Signal Hierarchy for Action Determination
//
// Score sets the baseline action. Signals adjust it:
//   Dealbreakers → force IGNORE regardless of score
//   Red flags    → cap action (can't auto-PRIORITIZE)
//   Missing essentials → downgrade one level
//   Strong positives → upgrade one level (within caps)
// ============================================

interface SignalContext {
  dimensions: DimensionResult[];
  riskFlags: RiskFlag[];
  missingContext: string[];
  conflictingSignals: string[];
}

const ACTION_RANK: Action[] = ['CLOSE', 'BATCH', 'REVIEW', 'PRIORITIZE'];

function shiftAction(action: Action, delta: number): Action {
  if (action === 'NEEDS_HUMAN_JUDGMENT') return action;
  const idx = ACTION_RANK.indexOf(action);
  const newIdx = Math.max(0, Math.min(ACTION_RANK.length - 1, idx + delta));
  return ACTION_RANK[newIdx];
}

function determineAction(
  compositeScore: number,
  priority: Priority,
  confidence: ConfidenceLevel,
  category: PRCategory,
  hasConflicts: boolean,
  signals: SignalContext
): Action {
  // ── Layer 0: Definitive low scores ──
  // Bad is bad. Uncertainty doesn't rescue a failing PR.
  if (compositeScore < 40) return 'CLOSE';

  // ── Layer 1: Dealbreakers ──
  // High-severity risk flags override everything.
  const hasHighRisk = signals.riskFlags.some(r => r.severity === 'high');
  if (hasHighRisk && compositeScore < 60) return 'CLOSE';

  // ── Layer 2: Trivial categories (handled separately) ──
  if (['DOCS_ONLY', 'FORMATTING_ONLY', 'COSMETIC_RENAME'].includes(category)) {
    return compositeScore >= 50 ? 'BATCH' : 'CLOSE';
  }

  if (category === 'DEPENDENCY_BUMP') {
    if (compositeScore >= 80) return 'REVIEW'; // Security-relevant dep bump
    return 'BATCH';
  }

  // ── Layer 3: Score-based baseline for code changes ──
  let action: Action;
  if (compositeScore >= 80) action = 'PRIORITIZE';
  else if (compositeScore >= 60) action = 'REVIEW';
  else action = 'BATCH'; // 40-59

  // ── Layer 4: Red flags cap the action ──
  // High-severity risks or breaking changes → can't auto-PRIORITIZE
  if (hasHighRisk && action === 'PRIORITIZE') {
    action = 'REVIEW';
  }

  // ── Layer 5: Missing essentials downgrade ──
  // No linked issue + no description = missing critical context
  const issueFit = signals.dimensions.find(d => d.key === 'issue_fit');
  const hasNoIssueContext = issueFit?.band === 'INSUFFICIENT_DATA';
  const testSignal = signals.dimensions.find(d => d.key === 'test_signal');
  const hasNoTests = testSignal?.band === 'WEAK' || testSignal?.band === 'INSUFFICIENT_DATA';

  // Missing essentials on code changes: downgrade one level
  if (category === 'CODE_CHANGE' && hasNoIssueContext && hasNoTests) {
    action = shiftAction(action, -1);
  }

  // ── Layer 6: Strong positives upgrade ──
  // All major dimensions STRONG + no risk flags = upgrade
  const majorDims = signals.dimensions.filter(d =>
    ['issue_fit', 'substance', 'pattern_alignment', 'scope_match'].includes(d.key)
  );
  const allMajorStrong = majorDims.length >= 3 &&
    majorDims.every(d => d.band === 'STRONG' || d.band === 'MODERATE');
  const noRiskFlags = signals.riskFlags.length === 0;

  if (allMajorStrong && noRiskFlags && action === 'REVIEW') {
    action = shiftAction(action, +1);
  }

  // ── Layer 7: Confidence / conflict overrides ──
  // Insufficient confidence on code changes → needs human eyes
  if (confidence === 'INSUFFICIENT' && category === 'CODE_CHANGE') {
    return 'NEEDS_HUMAN_JUDGMENT';
  }

  // Conflicting signals with medium-severity risks → human judgment
  // BUT: if the PR has strong fundamentals (3+ strong/moderate major dims),
  // the strong signal wins — conflicts are noted but don't override.
  const hasMediumRisk = signals.riskFlags.some(r => r.severity === 'medium');
  if (hasConflicts && hasMediumRisk && compositeScore >= 50 && compositeScore < 80) {
    if (!allMajorStrong) {
      return 'NEEDS_HUMAN_JUDGMENT';
    }
  }

  return action;
}

// ============================================
// Composite Score
// ============================================

function calculateCompositeScore(
  dimensions: DimensionResult[],
  riskFlags: RiskFlag[],
  category?: PRCategory
): number {
  const scoreable = dimensions.filter(
    (d) => d.band !== 'INSUFFICIENT_DATA'
  );

  if (scoreable.length === 0) return 50;

  const totalWeight = scoreable.reduce((sum, d) => sum + d.weight, 0);

  let base = 0;
  for (const dim of scoreable) {
    const normalizedWeight = dim.weight / totalWeight;
    base += BAND_SCORES[dim.band] * normalizedWeight;
  }

  // Penalties apply at full weight — severity already determines the base penalty
  // (high=12, medium=7, low=3). But cap total penalty to avoid score collapse
  // from stacking many small issues.
  const rawPenalty = riskFlags.reduce((sum, rf) => sum + rf.penalty, 0);
  const totalPenalty = Math.min(rawPenalty, 25); // Cap at 25 points
  base -= totalPenalty;

  if (checkMajorConflict(dimensions)) {
    base -= 5;
  }

  // Score floors by threat level:
  //   - PRs with high-severity risks can hit 0 (genuinely harmful)
  //   - Everything else floors at 8 (bad but not dangerous)
  //   - Trivial categories (docs, formatting) floor at 12 (low-effort, not malicious)
  const hasHighRisk = riskFlags.some(r => r.severity === 'high');
  const isTrivialCategory = category && ['DOCS_ONLY', 'FORMATTING_ONLY', 'COSMETIC_RENAME'].includes(category);

  let floor = 0;
  if (!hasHighRisk) {
    floor = isTrivialCategory ? 12 : 8;
  }

  return Math.max(floor, Math.min(100, Math.round(base)));
}

function checkMajorConflict(dimensions: DimensionResult[]): boolean {
  const bandOrder: Record<Band, number> = {
    STRONG: 3,
    MODERATE: 2,
    WEAK: 1,
    INSUFFICIENT_DATA: -1,
  };

  const majorDims = dimensions.filter(
    (d) =>
      ['issue_fit', 'substance', 'pattern_alignment', 'scope_match'].includes(d.key) &&
      d.band !== 'INSUFFICIENT_DATA'
  );

  for (let i = 0; i < majorDims.length; i++) {
    for (let j = i + 1; j < majorDims.length; j++) {
      const diff = Math.abs(
        bandOrder[majorDims[i].band] - bandOrder[majorDims[j].band]
      );
      if (diff >= 2) return true;
    }
  }

  return false;
}

// ============================================
// Main Parser
// ============================================

export function parseAndScoreLLMResponse(
  raw: string,
  customWeights?: Partial<Record<DimensionKey, number>>
): TriageResult {
  let jsonStr = raw.trim();
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  } else {
    const objMatch = raw.match(/\{[\s\S]*\}/);
    if (objMatch) {
      jsonStr = objMatch[0];
    }
  }

  const parsed: RawLLMResponse = JSON.parse(jsonStr);

  // Build dimension results
  const dimensions: DimensionResult[] = [];
  const dimensionKeys: DimensionKey[] = [
    'issue_fit', 'substance', 'pattern_alignment',
    'scope_match', 'test_signal', 'risk_flags',
  ];

  // Merge custom weights with defaults
  const weights = customWeights
    ? { ...DIMENSION_WEIGHTS, ...customWeights }
    : DIMENSION_WEIGHTS;

  for (const key of dimensionKeys) {
    const dim = parsed.dimensions[key];
    if (dim) {
      dimensions.push({
        name: DIMENSION_NAMES[key],
        key,
        band: parseBand(dim.band),
        weight: weights[key],
        evidence: Array.isArray(dim.evidence) ? dim.evidence : [],
        reasoning: String(dim.reasoning || ''),
      });
    }
  }

  // Parse risk flags with severity normalization.
  // LLMs tend to over-classify process/hygiene issues (missing description,
  // no tests, unfilled template) as "high" severity. True high severity is
  // reserved for security vulnerabilities, data loss, or harmful code changes.
  const HYGIENE_PATTERNS = [
    /description/i, /template/i, /unfilled/i, /empty.*body/i,
    /no.*test/i, /missing.*test/i, /no.*issue/i, /no.*linked/i,
    /documentation/i, /incomplete.*pr/i, /pr.*description/i,
  ];

  const riskFlags: RiskFlag[] = (parsed.risk_flags_detail || []).map((rf) => {
    let severity = parseSeverity(rf.severity);
    const flagText = `${rf.flag} ${rf.evidence}`;

    // Cap hygiene/process issues at medium — they're not dangerous, just sloppy
    if (severity === 'high' && HYGIENE_PATTERNS.some(p => p.test(flagText))) {
      severity = 'medium';
    }

    return {
      flag: String(rf.flag),
      severity,
      penalty: severity === 'high' ? 12 : severity === 'medium' ? 7 : 3,
      evidence: String(rf.evidence || ''),
    };
  });

  // Detect PR category first (needed for score floor)
  const prCategory = detectPRCategory(dimensions, riskFlags);

  // Calculate composite score (category affects floor)
  const compositeScore = calculateCompositeScore(dimensions, riskFlags, prCategory);

  // Three-axis output: confidence, priority, action
  const hasConflicts = (parsed.conflicting_signals || []).length > 0;
  const hasMajorConflict = checkMajorConflict(dimensions);

  const confidenceLevel = calculateConfidence(dimensions, parsed.missing_context || [], prCategory);
  const priority = calculatePriority(compositeScore, prCategory, hasConflicts || hasMajorConflict);
  const signalContext: SignalContext = {
    dimensions,
    riskFlags,
    missingContext: parsed.missing_context || [],
    conflictingSignals: parsed.conflicting_signals || [],
  };
  const action = determineAction(compositeScore, priority, confidenceLevel, prCategory, hasConflicts || hasMajorConflict, signalContext);

  // Deep Analysis fields (optional — only present in DEEP mode)
  const rawParsed = parsed as RawLLMResponse & {
    file_analysis?: Array<{ filename: string; purpose: string; quality: string; notes: string }>;
    security_review?: { risk_level: string; findings: string[] };
    maintainability?: { assessment: string; reasoning: string };
  };

  const fileAnalysis: FileAnalysis[] | undefined = rawParsed.file_analysis
    ? rawParsed.file_analysis.map((f) => ({
        filename: String(f.filename || ''),
        purpose: String(f.purpose || ''),
        quality: (['GOOD', 'ACCEPTABLE', 'CONCERNING'].includes(f.quality?.toUpperCase())
          ? f.quality.toUpperCase()
          : 'ACCEPTABLE') as FileAnalysis['quality'],
        notes: String(f.notes || ''),
      }))
    : undefined;

  const securityReview: SecurityReview | undefined = rawParsed.security_review
    ? {
        risk_level: (['NONE', 'LOW', 'MEDIUM', 'HIGH'].includes(rawParsed.security_review.risk_level?.toUpperCase())
          ? rawParsed.security_review.risk_level.toUpperCase()
          : 'LOW') as SecurityReview['risk_level'],
        findings: (rawParsed.security_review.findings || []).map(String),
      }
    : undefined;

  const maintainability: MaintainabilityAssessment | undefined = rawParsed.maintainability
    ? {
        assessment: (['IMPROVES', 'NEUTRAL', 'DEGRADES'].includes(rawParsed.maintainability.assessment?.toUpperCase())
          ? rawParsed.maintainability.assessment.toUpperCase()
          : 'NEUTRAL') as MaintainabilityAssessment['assessment'],
        reasoning: String(rawParsed.maintainability.reasoning || ''),
      }
    : undefined;

  return {
    compositeScore,
    confidenceLevel,
    priority,
    action,
    recommendation: action, // DB compat
    prCategory,
    executiveSummary: String(parsed.executive_summary || 'Analysis complete.'),
    dimensions,
    riskFlags,
    conflictingSignals: (parsed.conflicting_signals || []).map(String),
    missingContext: (parsed.missing_context || []).map(String),
    availableContext: (parsed.available_context || []).map(String),
    whatToVerify: (parsed.what_to_verify || []).map(String),
    strengths: (parsed.strengths || []).map(String),
    concerns: (parsed.concerns || []).map(String),
    ...(fileAnalysis && { fileAnalysis }),
    ...(securityReview && { securityReview }),
    ...(maintainability && { maintainability }),
  };
}
