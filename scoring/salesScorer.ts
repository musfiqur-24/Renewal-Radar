import { DomainResult, ScoreFactor, ScoringInput } from './types';
export function scoreSales(input: ScoringInput): DomainResult {
  const factors: ScoreFactor[] = [];
  if (input.hasExpansionDeal) factors.push({ id: 'expansion', category: 'Sales', weight: 15, impact: 10, title: 'Expansion opportunity', description: 'An associated expansion opportunity exists.' });
  const stage = input.renewalDealStage?.toLowerCase();
  if (stage?.includes('negotiation')) factors.push({ id: 'negotiation', category: 'Sales', weight: 15, impact: 5, title: 'Renewal in negotiation', description: 'The renewal deal is in negotiation.' });
  if (stage?.includes('lost')) factors.push({ id: 'closed-lost', category: 'Sales', weight: 15, impact: -10, title: 'Renewal closed lost', description: 'An associated renewal deal is closed lost.' });
  return { scoreContribution: factors.reduce((total, factor) => total + factor.impact, 0), factors };
}
