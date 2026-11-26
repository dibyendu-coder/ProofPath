import { describe, expect, it } from 'vitest';
import { buildEvidenceGraph } from '../graph/buildEvidenceGraph';
import { report, reviewedText } from '../graph/testFixture';
import {
  buildCommunicationDrafts,
  buildVerificationPlan,
} from './buildVerificationPlan';
import {
  initializeVerification,
  verificationProgress,
  verificationReducer,
} from './verificationReducer';

const at = '2026-11-26T00:00:00.000Z';
describe('deterministic verification plan', () => {
  it('links validated findings to exact evidence and stable category actions', () => {
    const a = buildVerificationPlan(report, reviewedText),
      b = buildVerificationPlan(report, reviewedText);
    expect(a.actions.map((item) => item.id)).toEqual(
      b.actions.map((item) => item.id),
    );
    const payment = a.actions.find((item) => item.category === 'payment')!;
    expect(payment.priority).toBe('high');
    expect(payment.findingIds).toEqual(['F-01']);
    expect(payment.evidence[0].quotation).toBe(report.findings[0].quotation);
    expect(
      reviewedText.slice(payment.evidence[0].start, payment.evidence[0].end),
    ).toBe(payment.evidence[0].quotation);
    expect(payment.questions.join(' ')).not.toContain('₹1,499');
    expect(
      a.actions.filter((item) => item.category === 'company_identity'),
    ).toHaveLength(1);
    expect(report.risk.score).toBe(44);
  });
  it('deduplicates overlapping findings, missing details, and recommendations', () => {
    const altered = {
      ...report,
      findings: [...report.findings, { ...report.findings[0], id: 'F-03' }],
      missingInformation: ['Official role listing', 'Published vacancy'],
      recommendedActions: [
        'Check the official careers page.',
        'Check the official careers page.',
      ],
    };
    const plan = buildVerificationPlan(altered, reviewedText);
    expect(
      plan.actions.filter((item) => item.category === 'payment'),
    ).toHaveLength(1);
    expect(
      plan.actions.find((item) => item.category === 'payment')?.findingIds,
    ).toEqual(['F-01', 'F-03']);
    expect(
      plan.actions.filter((item) => item.category === 'company_identity'),
    ).toHaveLength(1);
    expect(new Set(plan.actions.map((item) => item.id)).size).toBe(
      plan.actions.length,
    );
  });
  it('excludes unsupported source spans and handles ordinary or inconclusive reports honestly', () => {
    const bad = {
      ...report,
      findings: [{ ...report.findings[0], quotation: 'Invented fee' }],
      claims: [],
      missingInformation: [],
      recommendedActions: [],
    };
    const plan = buildVerificationPlan(bad, reviewedText);
    expect(plan.actions).toHaveLength(1);
    expect(plan.actions[0].basis).toBe('general_safety');
    expect(plan.actions[0].findingIds).toHaveLength(0);
    const ordinary = buildVerificationPlan(
      {
        ...report,
        findings: [],
        missingInformation: ['Employer identity', 'Selection process'],
        recommendedActions: [],
      },
      reviewedText,
    );
    expect(ordinary.actions.map((item) => item.category)).toEqual([
      'company_identity',
      'opportunity_details',
    ]);
    expect(ordinary.actions.every((item) => item.findingIds.length === 0)).toBe(
      true,
    );
  });
  it('keeps communication drafts neutral, editable, and free of invented recipients', () => {
    const drafts = buildCommunicationDrafts();
    expect(drafts.map((item) => item.id)).toEqual([
      'recruiter',
      'details',
      'payment',
      'independent',
    ]);
    expect(
      drafts.every(
        (item) =>
          !item.text.includes('₹1,499') &&
          !/\b[\w.-]+@[\w.-]+\.[a-z]{2,}\b/i.test(item.text),
      ),
    ).toBe(true);
  });
  it('adds only supported finding-action graph relationships and reuses action IDs', () => {
    const plan = buildVerificationPlan(report, reviewedText);
    const graph = buildEvidenceGraph(report, reviewedText, plan.actions);
    const payment = plan.actions.find((item) => item.category === 'payment')!;
    expect(graph.nodes.filter((item) => item.id === payment.id)).toHaveLength(
      1,
    );
    expect(
      graph.edges.some(
        (edge) =>
          edge.type === 'ADDRESSES' &&
          edge.from === payment.id &&
          edge.to === 'finding:F-01',
      ),
    ).toBe(true);
    const generic = plan.actions.find((item) => item.findingIds.length === 0)!;
    expect(
      graph.edges.some(
        (edge) =>
          edge.type === 'REQUIRES_VERIFICATION' && edge.to === generic.id,
      ),
    ).toBe(true);
    expect(new Set(graph.nodes.map((item) => item.id)).size).toBe(
      graph.nodes.length,
    );
  });
});

describe('in-memory verification state', () => {
  const plan = buildVerificationPlan(report, reviewedText);
  const id = plan.actions[0].id;
  it('records transitions and actual supplied timestamps without changing the risk report', () => {
    let state = initializeVerification(plan, at);
    expect(state.timeline).toHaveLength(1);
    state = verificationReducer(state, {
      type: 'start',
      actionId: id,
      at: '2026-11-26T00:01:00.000Z',
    });
    state = verificationReducer(state, {
      type: 'record',
      actionId: id,
      kind: 'response',
      text: 'I received a reply.',
      referenceUrl: 'https://example.org/policy',
      outcome: 'pending',
      at: '2026-11-26T00:02:00.000Z',
    });
    state = verificationReducer(state, {
      type: 'complete',
      actionId: id,
      at: '2026-11-26T00:03:00.000Z',
    });
    expect(state.actions[0].status).toBe('complete');
    expect(verificationProgress(state.actions).completed).toBe(1);
    state = verificationReducer(state, {
      type: 'reopen',
      actionId: id,
      at: '2026-11-26T00:04:00.000Z',
    });
    state = verificationReducer(state, {
      type: 'unresolved',
      actionId: id,
      at: '2026-11-26T00:05:00.000Z',
    });
    expect(state.actions[0].status).toBe('concern_unresolved');
    expect(verificationProgress(state.actions).unresolvedHigh).toBe(1);
    expect(state.timeline.map((item) => item.kind)).toEqual([
      'initialized',
      'started',
      'response_recorded',
      'completed',
      'reopened',
      'unresolved',
    ]);
    expect(state.timeline[2].at).toBe('2026-11-26T00:02:00.000Z');
    expect(report.risk.score).toBe(44);
  });
  it('rejects invalid notes and reference URLs, and gives notes unique IDs', () => {
    let state = initializeVerification(plan, at);
    const invalid = verificationReducer(state, {
      type: 'record',
      actionId: id,
      kind: 'note',
      text: 'x'.repeat(1001),
      referenceUrl: '',
      outcome: 'pending',
      at,
    });
    expect(invalid).toBe(state);
    expect(
      verificationReducer(state, {
        type: 'record',
        actionId: id,
        kind: 'note',
        text: 'safe',
        referenceUrl: 'javascript:alert(1)',
        outcome: 'pending',
        at,
      }),
    ).toBe(state);
    state = verificationReducer(state, {
      type: 'record',
      actionId: id,
      kind: 'note',
      text: 'First',
      referenceUrl: '',
      outcome: 'pending',
      at,
    });
    state = verificationReducer(state, {
      type: 'record',
      actionId: id,
      kind: 'note',
      text: 'Second',
      referenceUrl: '',
      outcome: 'pending',
      at,
    });
    expect(state.actions[0].notes.map((item) => item.id)).toEqual([
      'note:1',
      'note:2',
    ]);
    expect(state.timeline).toHaveLength(1);
  });
  it('isolates cases and bounds event history', () => {
    const second = buildVerificationPlan(
      { ...report, analysisId: 'another-analysis', caseId: 'another-case' },
      reviewedText,
    );
    expect(second.actions[0].id).not.toBe(plan.actions[0].id);
    expect(initializeVerification(second, at).actions[0].notes).toHaveLength(0);
    let state = initializeVerification(plan, at);
    for (let i = 0; i < 120; i++)
      state = verificationReducer(state, {
        type: i % 2 ? 'reopen' : 'unresolved',
        actionId: id,
        at: new Date(Date.parse(at) + i * 1000).toISOString(),
      });
    expect(state.timeline.length).toBeLessThanOrEqual(100);
  });
});
