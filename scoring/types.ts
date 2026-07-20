export type RiskLevel = 'healthy' | 'watch' | 'at_risk' | 'critical';
export type Trend = 'up' | 'down' | 'stable';

export interface ScoreFactor { id: string; category: string; weight: number; impact: number; title: string; description: string; }
export interface DomainResult { scoreContribution: number; factors: ScoreFactor[]; }
export interface ScoringInput {
  daysUntilRenewal?: number; activityDaysAgo?: number; openTickets?: number;
  hasHighPriorityTicket?: boolean; averageResolutionDays?: number;
  renewalDealStage?: string; hasExpansionDeal?: boolean; businessSignal?: number;
}
export interface RenewalRiskResult {
  score: number; previousScore: number | null; delta: number | null; trend: Trend;
  riskLevel: RiskLevel; calculatedAt: string; factors: ScoreFactor[];
}
