import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { report, reviewedText } from '../graph/testFixture';
import type { AnalysisReport, IntakeSuccess } from '../../shared/contracts';
import { buildVerificationPlan } from '../verification/buildVerificationPlan';
import {
  initializeVerification,
  verificationReducer,
} from '../verification/verificationReducer';
import { buildReportSnapshot } from './buildReportSnapshot';
import { defaultExportOptions, reportSnapshotSchema } from './types';
import { canonicalReportPayload, fingerprintReport } from './reportFingerprint';
import { exportJson, reportFilename } from './exportJson';
import { exportPdf } from './exportPdf';

vi.stubGlobal('crypto', webcrypto);
const intake: IntakeSuccess = {
  status: 'prepared',
  caseId: report.caseId,
  sourceType: 'text',
  submittedAt: report.analyzedAt,
  extractedText: reviewedText,
  extractionMethod: 'user_supplied',
  metadata: { characterCount: reviewedText.length },
  warnings: [],
};
const font = new Uint8Array(
  await readFile(new URL('./assets/NotoSans-Regular.ttf', import.meta.url)),
);
const at = '2026-11-28T00:00:00.000Z';
function caseInput(customReport: AnalysisReport = report, text = reviewedText) {
  const plan = buildVerificationPlan(customReport, text);
  return {
    report: customReport,
    result: { ...intake, caseId: customReport.caseId, extractedText: text },
    reviewedText: text,
    plan,
    verification: initializeVerification(plan, at),
    options: defaultExportOptions,
    exportedAt: at,
  };
}
describe('report snapshot and privacy', () => {
  it('validates a frozen snapshot, retains the original index, and excludes private data by default', async () => {
    const input = caseInput();
    const snapshot = await buildReportSnapshot(input);
    expect(reportSnapshotSchema.safeParse(snapshot).success).toBe(true);
    expect(Object.isFrozen(snapshot.findings[0])).toBe(true);
    expect(snapshot.risk).toEqual(report.risk);
    expect(snapshot.reviewedSource).toBeNull();
    expect(
      snapshot.verification.actions.every(
        (action) => action.notes === undefined,
      ),
    ).toBe(true);
    expect(snapshot.verification.timeline).toBeUndefined();
    expect(snapshot.findings[0].quotation).toContain('₹1,499');
    expect(snapshot.findings[0].start).toBeNull();
    expect(snapshot.evidence[0].origin).toBe('user_supplied');
    expect(snapshot.graph?.edges.some((edge) => edge.type === 'SUPPORTS')).toBe(
      true,
    );
    expect(snapshot.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(report.risk.score).toBe(44);
  });
  it('redacts contacts, URLs, and selected terms consistently without leaking the terms or invalid offsets', async () => {
    const text =
      'Frontend Engineering Internship. Pay ₹1,499 within 30 minutes to confirm your place. Contact careers@example.org. Visit https://example.org/apply or call +91 98765 43210.';
    const quote = 'Pay ₹1,499 within 30 minutes to confirm your place.';
    const start = text.indexOf(quote);
    const changed = {
      ...report,
      summary:
        'Contact careers@example.org at https://example.org/apply about ₹1,499.',
      findings: [
        {
          ...report.findings[0],
          quotation: quote,
          start,
          end: start + quote.length,
          explanation: 'Pay ₹1,499 to careers@example.org.',
        },
      ],
      claims: [],
      recommendedActions: ['Check https://example.org/apply.'],
    };
    const options = {
      ...defaultExportOptions,
      includeSource: true,
      includeNotes: true,
      includeTimeline: true,
      redactTerms: ['₹1,499'],
    };
    const input = caseInput(changed, text);
    let state = input.verification;
    state = verificationReducer(state, {
      type: 'record',
      actionId: input.plan.actions[0].id,
      kind: 'response',
      text: 'Reply from careers@example.org: pay ₹1,499',
      referenceUrl: 'https://example.org/policy',
      outcome: 'unresolved',
      at,
    });
    const snapshot = await buildReportSnapshot({
      ...input,
      verification: state,
      options,
    });
    const json = await exportJson(snapshot).text();
    expect(json).not.toContain('careers@example.org');
    expect(json).not.toContain('https://example.org');
    expect(json).not.toContain('₹1,499');
    expect(json).not.toContain('98765 43210');
    expect(json).not.toContain('"redactTerms"');
    expect(snapshot.findings[0].quotationRedacted).toBe(true);
    expect(snapshot.findings[0].start).toBeNull();
    expect(snapshot.findings[0].end).toBeNull();
    expect(snapshot.verification.actions[0].notes?.[0].referenceUrl).toBe(
      '[REDACTED URL]',
    );
    expect(
      snapshot.verification.timeline?.some(
        (event) => event.kind === 'response_recorded',
      ),
    ).toBe(true);
  });
  it('supports omitted quotations and graph, selected source, and stable fingerprint changes', async () => {
    const input = caseInput();
    const options = {
      ...defaultExportOptions,
      includeSource: true,
      includeQuotations: false,
      includeGraph: false,
    };
    const a = await buildReportSnapshot({ ...input, options });
    const b = await buildReportSnapshot({ ...input, options });
    expect(a.findings[0].quotation).toBeNull();
    expect(a.evidence).toHaveLength(0);
    expect(a.graph).toBeNull();
    expect(a.fingerprint).toBe(b.fingerprint);
    expect(a.fingerprint).toBe(await fingerprintReport(a));
    expect(canonicalReportPayload(a)).not.toContain('"fingerprint":"');
    const changed = await buildReportSnapshot({
      ...input,
      options: { ...options, includeGraph: true },
    });
    expect(changed.fingerprint).not.toBe(a.fingerprint);
  });
  it('rejects mismatched cases and sanitizes downloaded filenames', async () => {
    await expect(
      buildReportSnapshot({
        ...caseInput(),
        result: { ...intake, caseId: 'wrong' },
      }),
    ).rejects.toThrow(/do not match/);
    expect(reportFilename('../../bad|name', 'pdf')).toBe(
      'ProofPath-Investigation-badname.pdf',
    );
  });
  it('excludes a finding when its quotation no longer matches the reviewed source', async () => {
    const invalid = {
      ...report,
      findings: [{ ...report.findings[0], quotation: 'Invented quotation' }],
    };
    const snapshot = await buildReportSnapshot(caseInput(invalid));
    expect(snapshot.findings).toHaveLength(0);
    expect(snapshot.evidence).toHaveLength(0);
    expect(snapshot.risk.score).toBe(report.risk.score);
  });
  it('changes the fingerprint when exported content changes', async () => {
    const snapshot = await buildReportSnapshot(caseInput());
    const modified = { ...snapshot, summary: 'A modified summary.' };
    expect(await fingerprintReport(modified)).not.toBe(snapshot.fingerprint);
  });
});

describe('real PDF bytes for three fictional report profiles', () => {
  const ordinary =
    'Frontend Engineering Internship. Apply through the official careers portal. The role lasts 12 weeks and includes a written selection process.';
  const ambiguous =
    'A remote internship is available. Send your details to learn more about the role and selection process.';
  const cases = [
    { name: 'suspicious payment', report, text: reviewedText },
    {
      name: 'ordinary opportunity',
      report: {
        ...report,
        analysisId: 'ordinary-analysis',
        caseId: 'ordinary-case',
        summary: 'A standard application process is described.',
        findings: [],
        claims: [],
        missingInformation: ['Employer identity'],
        recommendedActions: ['Verify the official careers listing.'],
        risk: {
          score: 8,
          classification: 'Low risk',
          explanation: 'Few warning signs in this source.',
        },
      },
      text: ordinary,
    },
    {
      name: 'ambiguous opportunity',
      report: {
        ...report,
        analysisId: 'ambiguous-analysis',
        caseId: 'ambiguous-case',
        summary: 'Insufficient information to assess the offer.',
        findings: [],
        claims: [],
        missingInformation: ['Employer identity', 'Selection process'],
        recommendedActions: ['Ask for role details.'],
        risk: {
          score: 0,
          classification: 'Inconclusive',
          explanation: 'The source is too sparse.',
        },
      },
      text: ambiguous,
    },
  ];
  it.each(cases)(
    'generates a valid selectable-text PDF and matching JSON for $name',
    async ({ report: caseReport, text }) => {
      const snapshot = await buildReportSnapshot(
        caseInput(caseReport as AnalysisReport, text),
      );
      const start = performance.now();
      const bytes = await exportPdf(snapshot, font);
      expect(Buffer.from(bytes.subarray(0, 5)).toString()).toBe('%PDF-');
      const parsed = await PDFDocument.load(bytes);
      expect(parsed.getPageCount()).toBeGreaterThan(0);
      expect(bytes.length).toBeLessThan(1_500_000);
      const json = JSON.parse(await exportJson(snapshot).text());
      expect(json.risk.score).toBe(caseReport.risk.score);
      expect(json.fingerprint).toBe(snapshot.fingerprint);
      expect(parsed.getKeywords()).toContain(snapshot.fingerprint);
      expect(performance.now() - start).toBeLessThan(15_000);
    },
  );
  it('paginates long evidence and preserves the rupee glyph without substituting the amount', async () => {
    const quote = 'Payment ₹1,499 required within 30 minutes. '
      .repeat(80)
      .trim();
    const text = `Internship opening. ${quote} More details by email.`;
    const start = text.indexOf(quote);
    const long = {
      ...report,
      analysisId: 'long-analysis',
      caseId: 'long-case',
      summary: 'Long evidence with ₹1,499.',
      findings: [
        {
          ...report.findings[0],
          quotation: quote,
          start,
          end: start + quote.length,
        },
      ],
      claims: [],
      missingInformation: [],
      recommendedActions: [],
    };
    const snapshot = await buildReportSnapshot({
      ...caseInput(long, text),
      options: {
        ...defaultExportOptions,
        includeSource: true,
        includeGraph: false,
      },
    });
    const bytes = await exportPdf(snapshot, font);
    const parsed = await PDFDocument.load(bytes);
    expect(parsed.getPageCount()).toBeGreaterThan(2);
    expect(snapshot.findings[0].quotation).toContain('₹1,499');
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const loaded = await getDocument({
      data: new Uint8Array(bytes),
      useSystemFonts: false,
    }).promise;
    const extracted = (
      await Promise.all(
        Array.from({ length: loaded.numPages }, async (_, i) => {
          const page = await loaded.getPage(i + 1);
          const content = await page.getTextContent();
          return content.items
            .map((item) => ('str' in item ? item.str : ''))
            .join('');
        }),
      )
    ).join('');
    expect(extracted).toContain('₹1,499');
  }, 20000);
});
