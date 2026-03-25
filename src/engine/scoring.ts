import {
  Action,
  Band,
  BAND_SCORES,
  ConfidenceLevel,
  DimensionKey,
  DimensionResult,
  PRCategory,
  Priority,
  RiskFlag,
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

function determineAction(
  compositeScore: number,
  priority: Priority,
  confidence: ConfidenceLevel,
  category: PRCategory,
  hasConflicts: boolean
): Action {
  // FIRST: Low scores are definitive. If it scores poorly, we know enough
  // to say ignore — uncertainty doesn't rescue a bad PR.
  if (compositeScore < 40) return 'IGNORE';

  // Low confidence on code changes in the ambiguous range = needs human judgment
  if (confidence === 'INSUFFICIENT' && category === 'CODE_CHANGE') {
    return 'NEEDS_HUMAN_JUDGMENT';
  }

  // Conflicts on high-scoring code = needs human judgment
  if (hasConflicts && compositeScore >= 60 && category === 'CODE_CHANGE') {
    return 'NEEDS_HUMAN_JUDGMENT';
  }

  // Trivial categories with high confidence → ignore or batch
  if (['DOCS_ONLY', 'FORMATTING_ONLY', 'COSMETIC_RENAME'].includes(category)) {
    return compositeScore >= 50 ? 'BATCH' : 'IGNORE';
  }

  // Dep bumps
  if (category === 'DEPENDENCY_BUMP') {
    if (compositeScore >= 80) return 'REVIEW'; // Security-relevant
    return 'BATCH';
  }

  // Code changes: action based on score
  if (compositeScore >= 80) return 'PRIORITIZE';
  if (compositeScore >= 60) return 'REVIEW';
  return 'BATCH';
}

// ============================================
// Composite Score
// ============================================

function calculateCompositeScore(
  dimensions: DimensionResult[],
  riskFlags: RiskFlag[]
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

  const totalPenalty = riskFlags.reduce((sum, rf) => sum + rf.penalty, 0);
  base -= totalPenalty;

  if (checkMajorConflict(dimensions)) {
    base -= 5;
  }

  return Math.max(0, Math.min(100, Math.round(base)));
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

export function parseAndScoreLLMResponse(raw: string): TriageResult {
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

  for (const key of dimensionKeys) {
    const dim = parsed.dimensions[key];
    if (dim) {
      dimensions.push({
        name: DIMENSION_NAMES[key],
        key,
        band: parseBand(dim.band),
        weight: DIMENSION_WEIGHTS[key],
        evidence: Array.isArray(dim.evidence) ? dim.evidence : [],
        reasoning: String(dim.reasoning || ''),
      });
    }
  }

  // Parse risk flags
  const riskFlags: RiskFlag[] = (parsed.risk_flags_detail || []).map((rf) => ({
    flag: String(rf.flag),
    severity: parseSeverity(rf.severity),
    penalty: rf.severity === 'high' ? 12 : rf.severity === 'medium' ? 7 : 3,
    evidence: String(rf.evidence || ''),
  }));

  // Calculate composite score
  const compositeScore = calculateCompositeScore(dimensions, riskFlags);

  // Detect PR category
  const prCategory = detectPRCategory(dimensions, riskFlags);

  // Three-axis output: confidence, priority, action
  const hasConflicts = (parsed.conflicting_signals || []).length > 0;
  const hasMajorConflict = checkMajorConflict(dimensions);

  const confidenceLevel = calculateConfidence(dimensions, parsed.missing_context || [], prCategory);
  const priority = calculatePriority(compositeScore, prCategory, hasConflicts || hasMajorConflict);
  const action = determineAction(compositeScore, priority, confidenceLevel, prCategory, hasConflicts || hasMajorConflict);

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
  };
}
