import type { AnalysisReport, IntakeSuccess } from '../../shared/contracts';
import { buildEvidenceGraph, sourceSpan } from '../graph/buildEvidenceGraph';
import { verificationProgress } from '../verification/verificationReducer';
import type {
  VerificationPlan,
  VerificationState,
} from '../verification/types';
import { redactText } from './redactReport';
import { fingerprintReport } from './reportFingerprint';
import { reportSnapshotSchema, exportOptionsSchema } from './types';
import type { ExportOptions, ReportSnapshot } from './types';

const disclaimer =
  'Warning signs are not proof of fraud. Checklist completion does not establish legitimacy. The warning-sign index is a heuristic, not a calibrated fraud probability. Independently verify important details.';

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

export async function buildReportSnapshot(input: {
  report: AnalysisReport;
  result: IntakeSuccess;
  reviewedText: string;
  plan: VerificationPlan;
  verification: VerificationState | null;
  options: ExportOptions;
  exportedAt?: string;
}): Promise<ReportSnapshot> {
  const { report, result, reviewedText, plan, verification } = input;
  const options = exportOptionsSchema.parse(input.options);
  if (
    report.caseId !== result.caseId ||
    report.analysisId !== plan.analysisId ||
    plan.caseId !== report.caseId ||
    (verification && verification.analysisId !== report.analysisId)
  )
    throw new Error(
      'The investigation and verification state do not match. Reopen the report and try again.',
    );
  const exportedAt = input.exportedAt ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(exportedAt)))
    throw new Error('Invalid export timestamp.');
  const redact = (text: string) => redactText(text, options).text;
  const source = options.includeSource
    ? redactText(reviewedText, options)
    : null;
  const valid = report.findings.filter((finding) =>
    sourceSpan(reviewedText, finding.quotation, finding.start, finding.end),
  );
  const findings = valid.map((finding) => {
    const quote = options.includeQuotations
      ? redactText(finding.quotation, options)
      : null;
    const offsetsValid = Boolean(
      source && !source.redacted && quote && !quote.redacted,
    );
    return {
      id: finding.id,
      title: redact(finding.title),
      severity: finding.severity,
      category: redact(finding.category),
      explanation: redact(finding.explanation),
      uncertainty: finding.uncertainty,
      quotation: quote?.text ?? null,
      quotationRedacted: quote?.redacted ?? false,
      evidenceId: `E-${finding.id}`,
      origin: redact(finding.origin),
      start: offsetsValid ? finding.start : null,
      end: offsetsValid ? finding.end : null,
    };
  });
  const actions = (verification?.actions ?? plan.actions).map((action) => ({
    id: action.id,
    title: redact(action.title),
    priority: action.priority,
    status: action.status,
    basis: action.basis,
    method: redact(action.method),
    completionCriteria: redact(action.completionCriteria),
    findingIds: action.findingIds.filter((id) =>
      findings.some((finding) => finding.id === id),
    ),
    ...(options.includeNotes
      ? {
          notes: action.notes.map((note) => ({
            kind: note.kind,
            text: redact(note.text),
            referenceUrl: note.referenceUrl
              ? options.includeSourceUrls
                ? redact(note.referenceUrl)
                : '[REDACTED URL]'
              : null,
            outcome: note.outcome,
            recordedAt: note.recordedAt,
          })),
        }
      : {}),
  }));
  const progress = verificationProgress(verification?.actions ?? plan.actions);
  const graphRaw = options.includeGraph
    ? buildEvidenceGraph(report, reviewedText, plan.actions)
    : null;
  const supportedIds = new Set(findings.map((item) => `finding:${item.id}`));
  const graph = graphRaw
    ? {
        nodes: graphRaw.nodes
          .filter(
            (node) => node.type !== 'RISK_FINDING' || supportedIds.has(node.id),
          )
          .map((node) => ({
            id: node.id,
            type: node.type,
            title: redact(node.title),
            description: redact(node.description),
            origin: redact(node.origin),
            quotation:
              options.includeQuotations && node.quotation
                ? redact(node.quotation)
                : null,
          })),
        edges: graphRaw.edges
          .filter(
            (edge) =>
              graphRaw.nodes.some((node) => node.id === edge.from) &&
              graphRaw.nodes.some((node) => node.id === edge.to),
          )
          .map((edge) => ({ from: edge.from, to: edge.to, type: edge.type })),
      }
    : null;
  const snapshot = reportSnapshotSchema.parse({
    schemaVersion: '1.0.0',
    reportId: report.analysisId,
    caseId: report.caseId,
    analysisId: report.analysisId,
    analyzedAt: report.analyzedAt,
    exportedAt,
    sourceType: report.sourceType,
    extractionMethod: result.extractionMethod ?? 'unknown',
    sourceUrl: options.includeSourceUrls
      ? redact(
          result.provenance?.finalUrl ?? result.provenance?.originalUrl ?? '',
        ) || null
      : null,
    reviewedSource: source?.text ?? null,
    summary: redact(report.summary),
    risk: {
      score: report.risk.score,
      classification: redact(report.risk.classification),
      explanation: redact(report.risk.explanation),
    },
    findings,
    evidence: findings
      .filter((finding) => finding.quotation !== null)
      .map((finding) => ({
        id: finding.evidenceId,
        findingIds: [finding.id],
        quotation: finding.quotation!,
        quotationRedacted: finding.quotationRedacted,
        origin: finding.origin,
        start: finding.start,
        end: finding.end,
      })),
    missingInformation: report.missingInformation.map(redact),
    uncertaintyIndicators: report.uncertaintyIndicators.map(redact),
    recommendedActions: report.recommendedActions.map(redact),
    limitations: report.limitations.map(redact),
    ocrWarnings:
      result.sourceType === 'image' || result.sourceType === 'pdf'
        ? [
            ...(result.extractionMethod === 'image_ocr'
              ? [
                  'OCR text may misread currency symbols, digits, deadlines, and contact details. Compare the export with the original image.',
                ]
              : []),
            ...result.warnings,
          ].map(redact)
        : [],
    model: redact(report.model),
    verification: {
      ...progress,
      actions,
      ...(options.includeTimeline
        ? {
            timeline: (verification?.timeline ?? []).map((event) => ({
              at: event.at,
              kind: event.kind,
              label: redact(event.label),
            })),
          }
        : {}),
    },
    graph,
    options: {
      includeSource: options.includeSource,
      includeQuotations: options.includeQuotations,
      includeContacts: options.includeContacts,
      includeSourceUrls: options.includeSourceUrls,
      includeNotes: options.includeNotes,
      includeTimeline: options.includeTimeline,
      includeGraph: options.includeGraph,
      fingerprint: options.fingerprint,
      customRedactionCount: options.redactTerms.length,
    },
    disclaimer,
    fingerprint: null,
  });
  if (options.fingerprint)
    snapshot.fingerprint = await fingerprintReport(snapshot);
  return deepFreeze(snapshot);
}
