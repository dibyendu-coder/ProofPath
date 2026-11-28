import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import type { AnalysisReport, IntakeSuccess } from '../shared/contracts.ts';
import { report as template } from '../client/graph/testFixture.ts';
import { buildVerificationPlan } from '../client/verification/buildVerificationPlan.ts';
import {
  initializeVerification,
  verificationReducer,
} from '../client/verification/verificationReducer.ts';
import { buildReportSnapshot } from '../client/export/buildReportSnapshot.ts';
import { defaultExportOptions } from '../client/export/types.ts';
import { exportJson } from '../client/export/exportJson.ts';
import { exportPdf } from '../client/export/exportPdf.ts';

Object.defineProperty(globalThis, 'crypto', {
  value: webcrypto,
  configurable: true,
});
const font = new Uint8Array(
  await readFile(
    new URL('../client/export/assets/NotoSans-Regular.ttf', import.meta.url),
  ),
);
const out = new URL('../artifacts/phase7/', import.meta.url);
await mkdir(out, { recursive: true });
const at = '2026-11-28T12:00:00.000Z';
const suspicious =
  'Frontend Engineering Internship. Pay ₹1,499 within 30 minutes to confirm your place. Do not contact the company through its official website. Contact careers@example.org.';
const payment = 'Pay ₹1,499 within 30 minutes to confirm your place.';
const avoidance = 'Do not contact the company through its official website.';
const first = suspicious.indexOf(payment),
  second = suspicious.indexOf(avoidance);
const caseA: AnalysisReport = {
  ...template,
  analysisId: '11111111-1111-4111-8111-111111111111',
  caseId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  summary:
    'The message asks for an upfront payment under a short deadline and discourages independent contact.',
  claims: [],
  findings: [
    {
      ...template.findings[0],
      quotation: payment,
      start: first,
      end: first + payment.length,
    },
    {
      ...template.findings[1],
      quotation: payment,
      start: first,
      end: first + payment.length,
    },
    {
      ...template.findings[0],
      id: 'F-03',
      category: 'verification_avoidance',
      title: 'Discourages official verification',
      quotation: avoidance,
      start: second,
      end: second + avoidance.length,
      severity: 'high',
      explanation:
        'The source discourages checking through the official website.',
    },
  ],
  risk: {
    score: 60,
    classification: 'Elevated risk',
    explanation:
      'A heuristic warning-sign index based on retained text-supported findings.',
  },
  missingInformation: ['Official vacancy listing', 'Recruiter identity'],
  recommendedActions: [
    'Contact the organization through a channel found independently.',
  ],
};
const ordinary =
  'Frontend Engineering Internship at a published careers portal. Apply through the standard application form. The role lasts 12 weeks, includes a documented selection process, and pays a stated stipend.';
const caseB: AnalysisReport = {
  ...template,
  analysisId: '22222222-2222-4222-8222-222222222222',
  caseId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  summary:
    'A detailed ordinary internship description with a standard application process.',
  claims: [],
  findings: [],
  risk: {
    score: 8,
    classification: 'Low risk',
    explanation: 'Few warning signs were identified in the reviewed text.',
  },
  missingInformation: ['Employer identity'],
  recommendedActions: ['Confirm the role on the official careers page.'],
  limitations: ['No independent organization verification.'],
};
const ambiguous =
  'Remote internship available. Send your details to learn more about the role.';
const caseC: AnalysisReport = {
  ...template,
  analysisId: '33333333-3333-4333-8333-333333333333',
  caseId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  summary:
    'The source does not provide enough detail to assess the opportunity.',
  claims: [],
  findings: [],
  risk: {
    score: 0,
    classification: 'Inconclusive',
    explanation:
      'The source is too sparse for a supported warning-sign assessment.',
  },
  missingInformation: [
    'Employer identity',
    'Responsibilities and duration',
    'Selection process',
  ],
  recommendedActions: ['Request written role details.'],
  limitations: ['Insufficient source information.'],
};

async function save(
  name: string,
  report: AnalysisReport,
  text: string,
  redacted = false,
) {
  const plan = buildVerificationPlan(report, text);
  let verification = initializeVerification(plan, at);
  if (redacted && plan.actions.length) {
    verification = verificationReducer(verification, {
      type: 'start',
      actionId: plan.actions[0].id,
      at: '2026-11-28T12:01:00.000Z',
    });
    verification = verificationReducer(verification, {
      type: 'record',
      actionId: plan.actions[0].id,
      kind: 'response',
      text: 'The sender at careers@example.org asked for ₹1,499 again.',
      referenceUrl: 'https://example.org/policy',
      outcome: 'unresolved',
      at: '2026-11-28T12:02:00.000Z',
    });
  }
  const result: IntakeSuccess = {
    status: 'prepared',
    caseId: report.caseId,
    sourceType: 'text',
    submittedAt: at,
    extractedText: text,
    metadata: { characterCount: text.length },
    warnings: [],
    extractionMethod: 'user_supplied',
  };
  const options = redacted
    ? {
        ...defaultExportOptions,
        includeSource: true,
        includeNotes: true,
        includeTimeline: true,
        redactTerms: ['₹1,499'],
      }
    : defaultExportOptions;
  const snapshot = await buildReportSnapshot({
    report,
    result,
    reviewedText: text,
    plan,
    verification,
    options,
    exportedAt: at,
  });
  const started = performance.now();
  const pdf = await exportPdf(snapshot, font);
  const elapsed = Math.round(performance.now() - started);
  const json = await exportJson(snapshot).text();
  const prefix = redacted ? `${name}-redacted` : name;
  await writeFile(new URL(`${prefix}.pdf`, out), pdf);
  await writeFile(new URL(`${prefix}.json`, out), json);
  console.log(
    JSON.stringify({
      sample: prefix,
      pdfBytes: pdf.length,
      jsonBytes: Buffer.byteLength(json),
      pdfMs: elapsed,
      findingCount: snapshot.findings.length,
      index: snapshot.risk.score,
      fingerprint: snapshot.fingerprint,
    }),
  );
}
await save('case-a-suspicious', caseA, suspicious);
await save('case-b-ordinary', caseB, ordinary);
await save('case-c-ambiguous', caseC, ambiguous);
await save('case-a-suspicious', caseA, suspicious, true);
const longQuote = 'Pay ₹1,499 within 30 minutes to confirm your place. '
  .repeat(80)
  .trim();
const longText = `Internship offer. ${longQuote} Contact the official careers page independently.`;
const longStart = longText.indexOf(longQuote);
const longReport: AnalysisReport = {
  ...caseA,
  analysisId: '44444444-4444-4444-8444-444444444444',
  caseId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  summary: 'A deliberately long fictional quotation tests document pagination.',
  findings: [
    {
      ...caseA.findings[0],
      quotation: longQuote,
      start: longStart,
      end: longStart + longQuote.length,
    },
  ],
  missingInformation: [],
  recommendedActions: [],
  claims: [],
};
await save('case-long-evidence', longReport, longText);
