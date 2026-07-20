import { DomainResult, ScoreFactor, ScoringInput } from './types';
export function scoreContract(input: ScoringInput): DomainResult {
  if (input.daysUntilRenewal == null) return { scoreContribution: 0, factors: [] };
  const days = input.daysUntilRenewal;
  const impact = days < 0 ? -25 : days < 30 ? -15 : days < 90 ? 5 : days <= 180 ? 10 : 15;
  const title = days < 0 ? 'Renewal expired' : days < 30 ? 'Renewal approaching' : 'Renewal timing healthy';
  const factor: ScoreFactor = { id: 'renewal-date', category: 'Contract', weight: 25, impact, title, description: days < 0 ? `Renewal expired ${Math.abs(days)} days ago.` : `Renewal is due in ${days} days.` };
  return { scoreContribution: impact, factors: [factor] };
}
