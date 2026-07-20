import { DomainResult, ScoreFactor, ScoringInput } from './types';
export function scoreEngagement(input: ScoringInput): DomainResult {
  if (input.activityDaysAgo == null) return { scoreContribution: 0, factors: [] };
  const days = input.activityDaysAgo;
  const impact = days <= 7 ? 15 : days <= 30 ? 5 : days >= 90 ? -15 : days >= 60 ? -5 : 0;
  return { scoreContribution: impact, factors: [{ id: 'engagement-recency', category: 'Engagement', weight: 25, impact, title: impact >= 0 ? 'Recent customer engagement' : 'Customer engagement is stale', description: `Last recorded engagement was ${days} days ago.` }] };
}
