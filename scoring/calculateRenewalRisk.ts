import { scoreBusinessSignals } from './businessSignalScorer';
import { scoreContract } from './contractScorer';
import { scoreEngagement } from './engagementScorer';
import { scoreSales } from './salesScorer';
import { scoreSupport } from './supportScorer';
import { RenewalRiskResult, ScoringInput } from './types';

const clamp = (value: number) => Math.max(0, Math.min(100, value));
const riskLevel = (score: number): RenewalRiskResult['riskLevel'] => score >= 80 ? 'healthy' : score >= 60 ? 'watch' : score >= 40 ? 'at_risk' : 'critical';

export function calculateRenewalRisk(input: ScoringInput, previousScore: number | null = null): RenewalRiskResult {
  const results = [scoreContract(input), scoreEngagement(input), scoreSupport(input), scoreSales(input), scoreBusinessSignals(input)];
  const score = clamp(30 + results.reduce((total, result) => total + result.scoreContribution, 0));
  const delta = previousScore == null ? null : score - previousScore;
  return { score, previousScore, delta, trend: delta == null || Math.abs(delta) < 3 ? 'stable' : delta > 0 ? 'up' : 'down', riskLevel: riskLevel(score), calculatedAt: new Date().toISOString(), factors: results.flatMap((result) => result.factors) };
}
