import { DomainResult, ScoreFactor, ScoringInput } from './types';
export function scoreBusinessSignals(input: ScoringInput): DomainResult {
  if (input.businessSignal == null) return { scoreContribution: 0, factors: [] };
  return { scoreContribution: input.businessSignal, factors: [{ id: 'business-signal', category: 'Business', weight: 15, impact: input.businessSignal, title: input.businessSignal >= 0 ? 'Positive business signal' : 'Negative business signal', description: 'Optional product, CSAT, NPS, or growth signal.' }] };
}
