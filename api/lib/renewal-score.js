function calculateRenewalRisk({ openTickets = 0, renewalDealStage = '' }, previousScore = null) {
  const ticketImpact = openTickets === 0 ? 15 : openTickets <= 2 ? 10 : openTickets >= 6 ? -15 : 0;
  const stage = renewalDealStage.toLowerCase();
  const salesImpact = stage.includes('lost') ? -25 : stage.includes('negotiation') ? 5 : 0;
  const score = Math.max(0, Math.min(100, 30 + ticketImpact + salesImpact));
  const delta = previousScore == null ? null : score - previousScore;
  return { score, delta, trend: delta == null || Math.abs(delta) < 3 ? 'flat' : delta > 0 ? 'up' : 'down', riskLevel: score >= 80 ? 'healthy' : score >= 60 ? 'watch' : score >= 40 ? 'at_risk' : 'critical', factors: [{ id: 'tickets', impact: ticketImpact }, { id: 'sales', impact: salesImpact }] };
}
module.exports = { calculateRenewalRisk };
