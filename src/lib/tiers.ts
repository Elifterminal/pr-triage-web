export type PlanTier = 'FREE' | 'PRO' | 'TEAM';

export interface TierLimits {
  dailyAnalyses: number;       // max analyses per day (0 = unlimited)
  historyDays: number;         // how long results persist (0 = forever)
  deepAnalysis: boolean;       // can use Deep Analysis mode
  shareableLinks: boolean;     // can share analysis results
  batchAnalysis: boolean;      // can paste multiple PR URLs
  connectedRepos: number;      // GitHub App auto-analysis repos (0 = none)
  exportResults: boolean;      // JSON/CSV export
  apiAccess: boolean;          // REST API for CI/CD
  customRules: boolean;        // custom dimension weights / thresholds
  teamMembers: number;         // max team members (0 = solo)
}

export const TIER_CONFIG: Record<PlanTier, TierLimits> = {
  FREE: {
    dailyAnalyses: 3,
    historyDays: 7,
    deepAnalysis: false,
    shareableLinks: false,
    batchAnalysis: false,
    connectedRepos: 0,
    exportResults: false,
    apiAccess: false,
    customRules: false,
    teamMembers: 0,
  },
  PRO: {
    dailyAnalyses: 0, // unlimited
    historyDays: 0,    // forever
    deepAnalysis: true,
    shareableLinks: true,
    batchAnalysis: true,
    connectedRepos: 5,
    exportResults: true,
    apiAccess: false,
    customRules: false,
    teamMembers: 0,
  },
  TEAM: {
    dailyAnalyses: 0,
    historyDays: 0,
    deepAnalysis: true,
    shareableLinks: true,
    batchAnalysis: true,
    connectedRepos: 999, // unlimited
    exportResults: true,
    apiAccess: true,
    customRules: true,
    teamMembers: 10,
  },
};

export const TIER_LABELS: Record<PlanTier, string> = {
  FREE: 'Free',
  PRO: 'Pro',
  TEAM: 'Team',
};

export function getTierLimits(plan: string): TierLimits {
  return TIER_CONFIG[(plan as PlanTier)] || TIER_CONFIG.FREE;
}

export function canPerformAnalysis(plan: string, todayCount: number): { allowed: boolean; reason?: string } {
  const limits = getTierLimits(plan);
  if (limits.dailyAnalyses === 0) return { allowed: true };
  if (todayCount >= limits.dailyAnalyses) {
    return {
      allowed: false,
      reason: `Daily limit reached (${limits.dailyAnalyses} per day on ${TIER_LABELS[plan as PlanTier] || 'Free'} plan). Upgrade to Pro for unlimited analyses.`,
    };
  }
  return { allowed: true };
}
