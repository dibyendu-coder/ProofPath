import type { validateEvidence } from './evidence-validator.js';

type Findings = ReturnType<typeof validateEvidence>['findings'];
const weights: Record<Findings[number]['category'], number> = {
  payment: 28,
  urgency: 16,
  personal_information: 22,
  identity: 15,
  channel: 9,
  compensation: 8,
  verification_avoidance: 20,
  link: 14,
  contradiction: 15,
  other: 8,
};
const severityFactor = { low: 0.5, medium: 0.75, high: 1 };

export function scoreRisk(findings: Findings, sourceLength: number) {
  const grouped = new Map<string, number>();
  for (const finding of findings) {
    const factor =
      severityFactor[finding.severity] *
      (finding.uncertainty === 'high'
        ? 0.4
        : finding.uncertainty === 'medium'
          ? 0.7
          : 1);
    grouped.set(
      finding.category,
      Math.max(
        grouped.get(finding.category) ?? 0,
        weights[finding.category] * factor,
      ),
    );
  }
  const score = Math.min(
    100,
    Math.round([...grouped.values()].reduce((sum, value) => sum + value, 0)),
  );
  const classification =
    sourceLength < 50 ||
    findings.length === 0 ||
    findings.every((finding) => finding.uncertainty === 'high')
      ? 'Inconclusive'
      : score >= 65
        ? 'High risk'
        : score >= 40
          ? 'Elevated risk'
          : score >= 20
            ? 'Caution advised'
            : 'Limited warning signs';
  return {
    score,
    classification,
    explanation:
      'Heuristic warning-sign index, not a probability of fraud or legitimacy. Categories count once at their strongest supported severity; uncertainty reduces their weight.',
  };
}
