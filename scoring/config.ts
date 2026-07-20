export interface ScoringConfig { contractWeight: number; engagementWeight: number; supportWeight: number; salesWeight: number; businessWeight: number; }
export const DEFAULT_SCORING_CONFIG: ScoringConfig = { contractWeight: 25, engagementWeight: 25, supportWeight: 20, salesWeight: 15, businessWeight: 15 };
