export type VerificationCategory =
  | 'payment'
  | 'urgency'
  | 'recruiter_identity'
  | 'company_identity'
  | 'communication_channel'
  | 'opportunity_details'
  | 'sensitive_information'
  | 'suspicious_link'
  | 'verification_avoidance'
  | 'unconfirmed_claim'
  | 'missing_information'
  | 'general';
export type VerificationStatus =
  | 'not_started'
  | 'in_progress'
  | 'response_recorded'
  | 'complete'
  | 'concern_unresolved';
export type VerificationPriority = 'high' | 'standard';
export type VerificationBasis =
  'finding' | 'missing_detail' | 'report_recommendation' | 'general_safety';
export type VerificationEvidence = {
  quotation: string;
  origin: string;
  start: number;
  end: number;
};
export type EvidenceNote = {
  id: string;
  actionId: string;
  kind: 'note' | 'response';
  text: string;
  referenceUrl: string;
  outcome: 'pending' | 'helpful' | 'unresolved';
  recordedAt: string;
};
export type VerificationAction = {
  id: string;
  category: VerificationCategory;
  title: string;
  description: string;
  priority: VerificationPriority;
  basis: VerificationBasis;
  findingIds: string[];
  evidence: VerificationEvidence[];
  method: string;
  questions: string[];
  completionCriteria: string;
  status: VerificationStatus;
  notes: EvidenceNote[];
};
export type VerificationPlan = {
  caseId: string;
  analysisId: string;
  actions: VerificationAction[];
};
export type TimelineEvent = {
  id: number;
  at: string;
  kind:
    | 'initialized'
    | 'started'
    | 'response_recorded'
    | 'completed'
    | 'reopened'
    | 'unresolved';
  actionId?: string;
  label: string;
};
export type VerificationState = {
  caseId: string;
  analysisId: string;
  actions: VerificationAction[];
  timeline: TimelineEvent[];
  nextEventId: number;
  nextNoteId: number;
};
