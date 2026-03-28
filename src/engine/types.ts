// ============================================
// Dimension Bands
// ============================================

export type Band = 'STRONG' | 'MODERATE' | 'WEAK' | 'INSUFFICIENT_DATA';

export const BAND_SCORES: Record<Band, number> = {
  STRONG: 90,
  MODERATE: 60,
  WEAK: 25,
  INSUFFICIENT_DATA: -1, // Excluded from composite
};

// ============================================
// Dimension Types
// ============================================

export interface DimensionResult {
  name: string;
  key: DimensionKey;
  band: Band;
  weight: number;
  evidence: string[];
  reasoning: string;
}

export type DimensionKey =
  | 'issue_fit'
  | 'substance'
  | 'pattern_alignment'
  | 'scope_match'
  | 'test_signal'
  | 'risk_flags';

// ============================================
// Risk Flags
// ============================================

export interface RiskFlag {
  flag: string;
  severity: 'low' | 'medium' | 'high';
  penalty: number;
  evidence: string;
}

// ============================================
// Analysis Result
// ============================================

export type Action =
  | 'CLOSE'
  | 'BATCH'
  | 'REVIEW'
  | 'PRIORITIZE'
  | 'NEEDS_HUMAN_JUDGMENT';

export type Priority = 'HIGH' | 'MEDIUM' | 'LOW';

export type ConfidenceLevel = 'HIGH' | 'MODERATE' | 'LOW' | 'INSUFFICIENT';

// Kept for backward compat with DB schema string field
export type Recommendation =
  | 'CLOSE'
  | 'BATCH'
  | 'REVIEW'
  | 'PRIORITIZE'
  | 'NEEDS_HUMAN_JUDGMENT';

// PR category detection for context-sensitive scoring
export type PRCategory =
  | 'DOCS_ONLY'
  | 'DEPENDENCY_BUMP'
  | 'FORMATTING_ONLY'
  | 'COSMETIC_RENAME'
  | 'CODE_CHANGE';

export interface FileAnalysis {
  filename: string;
  purpose: string;
  quality: 'GOOD' | 'ACCEPTABLE' | 'CONCERNING';
  notes: string;
}

export interface SecurityReview {
  risk_level: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
  findings: string[];
}

export interface MaintainabilityAssessment {
  assessment: 'IMPROVES' | 'NEUTRAL' | 'DEGRADES';
  reasoning: string;
}

export interface TriageResult {
  compositeScore: number;
  confidenceLevel: ConfidenceLevel;
  priority: Priority;
  action: Action;
  recommendation: Recommendation; // alias for action, stored in DB
  prCategory: PRCategory;
  executiveSummary: string;
  dimensions: DimensionResult[];
  riskFlags: RiskFlag[];
  conflictingSignals: string[];
  missingContext: string[];
  availableContext: string[];
  whatToVerify: string[];
  strengths: string[];
  concerns: string[];
  // Deep Analysis only
  fileAnalysis?: FileAnalysis[];
  securityReview?: SecurityReview;
  maintainability?: MaintainabilityAssessment;
}

// ============================================
// PR Input Data
// ============================================

export interface PRInputData {
  url: string;
  owner: string;
  repo: string;
  number: number;
  title: string;
  body: string;
  author: string;
  baseBranch: string;
  headBranch: string;
  isDraft: boolean;
  labels: string[];
  files: PRFile[];
  diff: string;
  linkedIssues: LinkedIssue[];
  repoDescription: string;
  repoLanguage: string;
  contributing: string | null;
}

export interface PRFile {
  filename: string;
  status: string;
  patch: string;
  additions: number;
  deletions: number;
}

export interface LinkedIssue {
  number: number;
  title: string;
  body: string;
  labels: string[];
}

// ============================================
// LLM Provider Interface
// ============================================

export interface LLMProvider {
  evaluate(systemPrompt: string, userPrompt: string): Promise<string>;
}

export type ProviderType = 'ANTHROPIC' | 'OPENAI' | 'OPENROUTER' | 'GEMINI';

export const DEFAULT_MODELS: Record<ProviderType, string> = {
  ANTHROPIC: 'claude-sonnet-4-20250514',
  OPENAI: 'gpt-4o-mini',
  OPENROUTER: 'anthropic/claude-sonnet-4',
  GEMINI: 'gemini-2.0-flash',
};
