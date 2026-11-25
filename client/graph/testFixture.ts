import type { AnalysisReport } from '../../shared/contracts';

export const reviewedText =
  'Frontend Engineering Internship. Pay ₹1,499 within 30 minutes to confirm your place. Contact careers@example.org.';
const quotation = 'Pay ₹1,499 within 30 minutes to confirm your place.';
const start = reviewedText.indexOf(quotation);
export const report: AnalysisReport = {
  status: 'complete',
  analysisId: 'a38c262f-35d0-4d3d-a068-c33fa293dc12',
  caseId: '63a74404-0424-4125-b5d3-f856e166ecab',
  analyzedAt: '2026-11-25T00:00:00.000Z',
  model: 'openai/gpt-oss-20b',
  providerMetrics: { latencyMs: 50, requests: 1, usage: null },
  sourceType: 'text',
  evidenceOrigin: 'user_supplied',
  provenanceAuthenticated: false,
  opportunityType: 'internship',
  summary: 'The source contains warning signs.',
  claims: [
    {
      text: 'Frontend Engineering Internship',
      quotation: 'Frontend Engineering Internship.',
      origin: 'user_supplied',
      userCorrected: false,
      start: 0,
      end: 32,
    },
  ],
  findings: [
    {
      id: 'F-01',
      category: 'payment',
      title: 'Upfront fee',
      severity: 'high',
      explanation: 'The source requests payment.',
      quotation,
      uncertainty: 'low',
      origin: 'user_supplied',
      userCorrected: false,
      start,
      end: start + quotation.length,
    },
    {
      id: 'F-02',
      category: 'urgency',
      title: 'Short deadline',
      severity: 'medium',
      explanation: 'The source sets a 30-minute deadline.',
      quotation,
      uncertainty: 'medium',
      origin: 'user_supplied',
      userCorrected: false,
      start,
      end: start + quotation.length,
    },
  ],
  rejectedEvidenceCount: 0,
  missingInformation: ['Official role listing'],
  uncertaintyIndicators: ['Recruiter identity is unconfirmed'],
  recommendedActions: ['Check the official careers page.'],
  limitations: ['No independent verification.'],
  risk: {
    score: 44,
    classification: 'Elevated risk',
    explanation: 'A heuristic warning-sign index.',
  },
};
