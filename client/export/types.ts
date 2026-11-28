import { z } from 'zod';

export const exportOptionsSchema = z.object({
  includeSource: z.boolean(),
  includeQuotations: z.boolean(),
  includeContacts: z.boolean(),
  includeSourceUrls: z.boolean(),
  includeNotes: z.boolean(),
  includeTimeline: z.boolean(),
  includeGraph: z.boolean(),
  fingerprint: z.boolean(),
  redactTerms: z.array(z.string().min(1).max(120)).max(20),
});
export type ExportOptions = z.infer<typeof exportOptionsSchema>;
export const defaultExportOptions: ExportOptions = {
  includeSource: false,
  includeQuotations: true,
  includeContacts: false,
  includeSourceUrls: false,
  includeNotes: false,
  includeTimeline: false,
  includeGraph: true,
  fingerprint: true,
  redactTerms: [],
};

const findingSchema = z.object({
  id: z.string(),
  title: z.string(),
  severity: z.enum(['low', 'medium', 'high']),
  category: z.string(),
  explanation: z.string(),
  uncertainty: z.enum(['low', 'medium', 'high']),
  quotation: z.string().nullable(),
  quotationRedacted: z.boolean(),
  evidenceId: z.string(),
  origin: z.string(),
  start: z.number().int().nullable(),
  end: z.number().int().nullable(),
});
const noteSchema = z.object({
  kind: z.enum(['note', 'response']),
  text: z.string(),
  referenceUrl: z.string().nullable(),
  outcome: z.enum(['pending', 'helpful', 'unresolved']),
  recordedAt: z.string(),
});
const actionSchema = z.object({
  id: z.string(),
  title: z.string(),
  priority: z.enum(['high', 'standard']),
  status: z.enum([
    'not_started',
    'in_progress',
    'response_recorded',
    'complete',
    'concern_unresolved',
  ]),
  basis: z.string(),
  method: z.string(),
  completionCriteria: z.string(),
  findingIds: z.array(z.string()),
  notes: z.array(noteSchema).optional(),
});
export const reportSnapshotSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  reportId: z.string(),
  caseId: z.string(),
  analysisId: z.string(),
  analyzedAt: z.string(),
  exportedAt: z.string(),
  sourceType: z.enum(['text', 'url', 'image', 'pdf']),
  extractionMethod: z.string(),
  sourceUrl: z.string().nullable(),
  reviewedSource: z.string().nullable(),
  summary: z.string(),
  risk: z.object({
    score: z.number().min(0).max(100),
    classification: z.string(),
    explanation: z.string(),
  }),
  findings: z.array(findingSchema).max(12),
  evidence: z
    .array(
      z.object({
        id: z.string(),
        findingIds: z.array(z.string()),
        quotation: z.string(),
        quotationRedacted: z.boolean(),
        origin: z.string(),
        start: z.number().int().nullable(),
        end: z.number().int().nullable(),
      }),
    )
    .max(12),
  missingInformation: z.array(z.string()),
  uncertaintyIndicators: z.array(z.string()),
  recommendedActions: z.array(z.string()),
  limitations: z.array(z.string()),
  ocrWarnings: z.array(z.string()),
  model: z.string(),
  verification: z.object({
    total: z.number().int(),
    started: z.number().int(),
    completed: z.number().int(),
    remaining: z.number().int(),
    unresolvedHigh: z.number().int(),
    actions: z.array(actionSchema),
    timeline: z
      .array(z.object({ at: z.string(), kind: z.string(), label: z.string() }))
      .optional(),
  }),
  graph: z
    .object({
      nodes: z.array(
        z.object({
          id: z.string(),
          type: z.string(),
          title: z.string(),
          description: z.string(),
          origin: z.string(),
          quotation: z.string().nullable(),
        }),
      ),
      edges: z.array(
        z.object({ from: z.string(), to: z.string(), type: z.string() }),
      ),
    })
    .nullable(),
  options: exportOptionsSchema
    .omit({ redactTerms: true })
    .extend({ customRedactionCount: z.number().int() }),
  disclaimer: z.string(),
  fingerprint: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .nullable(),
});
export type ReportSnapshot = z.infer<typeof reportSnapshotSchema>;
