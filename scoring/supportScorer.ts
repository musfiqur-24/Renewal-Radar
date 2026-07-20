import { DomainResult, ScoreFactor, ScoringInput } from './types';
export function scoreSupport(input: ScoringInput): DomainResult {
  if (input.openTickets == null) return { scoreContribution: 0, factors: [] };
  const countImpact = input.openTickets === 0 ? 15 : input.openTickets <= 2 ? 10 : input.openTickets >= 6 ? -15 : 0;
  const factors: ScoreFactor[] = [{ id: 'open-tickets', category: 'Support', weight: 20, impact: countImpact, title: input.openTickets === 0 ? 'Support healthy' : 'Open support tickets', description: `${input.openTickets} open ticket(s).` }];
  if (input.hasHighPriorityTicket) factors.push({ id: 'priority-ticket', category: 'Support', weight: 20, impact: -10, title: 'High-priority ticket open', description: 'At least one high-priority support ticket remains open.' });
  if ((input.averageResolutionDays ?? 0) > 7) factors.push({ id: 'resolution-time', category: 'Support', weight: 20, impact: -10, title: 'Slow ticket resolution', description: 'Average ticket resolution exceeds seven days.' });
  return { scoreContribution: factors.reduce((total, factor) => total + factor.impact, 0), factors };
}
