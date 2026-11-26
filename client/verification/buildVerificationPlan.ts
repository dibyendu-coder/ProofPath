import type { AnalysisReport } from '../../shared/contracts';
import { sourceSpan } from '../graph/buildEvidenceGraph';
import {
  categoryForFinding,
  categoryForMissing,
  templates,
} from './questionTemplates';
import type {
  VerificationAction,
  VerificationCategory,
  VerificationPlan,
} from './types';

const normalize = (value: string) =>
  value.trim().replace(/\s+/g, ' ').toLowerCase();
function stableHash(value: string) {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function buildVerificationPlan(
  report: AnalysisReport,
  reviewedText: string,
): VerificationPlan {
  const actions = new Map<string, VerificationAction>();
  const base = (
    category: VerificationCategory,
    basis: VerificationAction['basis'],
    id: string,
  ): VerificationAction => {
    const t = templates[category];
    return {
      id,
      category,
      title: t.title,
      description: t.description,
      priority: 'standard',
      basis,
      findingIds: [],
      evidence: [],
      method: t.method,
      questions: [...t.questions],
      completionCriteria: t.criteria,
      status: 'not_started',
      notes: [],
    };
  };
  for (const finding of report.findings) {
    if (
      !sourceSpan(reviewedText, finding.quotation, finding.start, finding.end)
    )
      continue;
    const category = categoryForFinding(finding.category);
    const key = `category:${category}`;
    let action = actions.get(key);
    if (!action) {
      action = base(
        category,
        'finding',
        `verify:${report.analysisId}:${category}`,
      );
      actions.set(key, action);
    }
    if (!action.findingIds.includes(finding.id))
      action.findingIds.push(finding.id);
    if (
      !action.evidence.some(
        (item) =>
          item.start === finding.start &&
          item.end === finding.end &&
          item.origin === finding.origin,
      )
    )
      action.evidence.push({
        quotation: finding.quotation,
        start: finding.start,
        end: finding.end,
        origin: finding.origin,
      });
    if (finding.severity === 'high') action.priority = 'high';
  }
  for (const detail of report.missingInformation) {
    const text = detail.trim();
    if (!text) continue;
    const category = categoryForMissing(text);
    const key = `category:${category}`;
    if (actions.has(key)) continue;
    const action = base(
      category,
      'missing_detail',
      `verify:${report.analysisId}:${category}`,
    );
    action.description = `Missing detail identified in the report: ${text}. ${action.description}`;
    actions.set(key, action);
  }
  const seenRecommendation = new Set<string>();
  for (const recommendation of report.recommendedActions) {
    const text = recommendation.trim();
    const normalized = normalize(text);
    if (!normalized || seenRecommendation.has(normalized)) continue;
    seenRecommendation.add(normalized);
    const category = categoryForMissing(text);
    if (actions.has(`category:${category}`)) continue;
    const id = `verify:${report.analysisId}:recommendation:${stableHash(normalized)}`;
    actions.set(`recommendation:${normalized}`, {
      ...base('general', 'report_recommendation', id),
      title: 'Follow a report recommendation',
      description: text,
    });
  }
  if (!actions.size)
    actions.set(
      'general',
      base('general', 'general_safety', `verify:${report.analysisId}:general`),
    );
  const priority = (action: VerificationAction) =>
    action.priority === 'high' ? 0 : 1;
  return {
    caseId: report.caseId,
    analysisId: report.analysisId,
    actions: [...actions.values()].sort(
      (a, b) => priority(a) - priority(b) || a.id.localeCompare(b.id),
    ),
  };
}

export type CommunicationDraft = { id: string; title: string; text: string };
export function buildCommunicationDrafts(): CommunicationDraft[] {
  return [
    {
      id: 'recruiter',
      title: 'Confirm recruiter identity',
      text: 'Hello,\n\nThank you for sharing the opportunity. Could you provide your official organization email address and the location of this role on your published careers page? I would like to verify the details through an independent channel before proceeding.\n\nThank you.',
    },
    {
      id: 'details',
      title: 'Request opportunity details',
      text: 'Hello,\n\nThank you for the opportunity. Could you send the responsibilities, duration, selection process, reporting arrangements, and any compensation details in writing? I would also appreciate a link to the role on your official careers page.\n\nThank you.',
    },
    {
      id: 'payment',
      title: 'Clarify payment policy',
      text: 'Hello,\n\nBefore proceeding, could you explain whether any payment is required under your official recruitment policy and provide the written policy? I will confirm the policy through an independently found organization contact.\n\nThank you.',
    },
    {
      id: 'independent',
      title: 'Request independent offer verification',
      text: 'Hello,\n\nI would like to confirm this opportunity through your organization’s published HR or careers contact before taking further steps. Could you provide the official vacancy reference and a contact route listed on your website?\n\nThank you.',
    },
  ];
}
