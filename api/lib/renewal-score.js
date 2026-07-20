function calculateRenewalRisk({ openTickets = 0, dealCreated = false, dealAssociationRemoved = false, dealStageChanged = false, renewalDealStage = '' }, previousScore = null) {
  // Deal events are incremental; do not reapply ticket points every time a deal moves stage.
  const ticketImpact = 0;
  const stage = renewalDealStage.toLowerCase();
  const creationImpact = dealCreated ? 10 : 0;
  const associationRemovalImpact = dealAssociationRemoved ? -15 : 0;
  const stageChangeImpact = dealStageChanged ? 1 : 0;
  const outcomeImpact = stage.includes('closedwon') ? 15 : stage.includes('closedlost') ? -10 : 0;
  const score = Math.max(0, Math.min(100, (previousScore ?? 30) + ticketImpact + creationImpact + associationRemovalImpact + stageChangeImpact + outcomeImpact));
  const delta = previousScore == null ? null : score - previousScore;
  return { score, delta, trend: delta == null || Math.abs(delta) < 3 ? 'flat' : delta > 0 ? 'up' : 'down', riskLevel: score >= 80 ? 'healthy' : score >= 60 ? 'watch' : score >= 40 ? 'at_risk' : 'critical', factors: [{ id: 'tickets', impact: ticketImpact }, { id: 'deal-created', impact: creationImpact }, { id: 'deal-association-removed', impact: associationRemovalImpact }, { id: 'stage-changed', impact: stageChangeImpact }, { id: 'deal-outcome', impact: outcomeImpact }] };
}
module.exports = { calculateRenewalRisk };
