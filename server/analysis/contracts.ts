import { z } from 'zod';

export const category = z.enum([
  'payment',
  'urgency',
  'personal_information',
  'identity',
  'channel',
  'compensation',
  'verification_avoidance',
  'link',
  'contradiction',
  'other',
]);
export const severity = z.enum(['low', 'medium', 'high']);
export const uncertainty = z.enum(['low', 'medium', 'high']);
const short = z.string().trim().min(1).max(240);
const sentence = z.string().trim().min(1).max(600);

export const analyzeRequest = z
  .object({
    caseId: z.uuid(),
    sourceType: z.enum(['text', 'url', 'image', 'pdf']),
    extractionMethod: z.enum([
      'user_supplied',
      'html_text',
      'plain_text',
      'image_ocr',
      'pdf_text',
      'none',
    ]),
    reviewedText: z
      .string()
      .min(20)
      .max(20_000)
      .refine((value) => value.trim().length >= 20),
    userCorrected: z.boolean(),
    confirmed: z.literal(true),
  })
  .strict();

export const modelAnalysis = z
  .object({
    opportunityType: z.enum([
      'internship',
      'job',
      'scholarship',
      'recruitment_message',
      'offer_letter',
      'other',
      'unknown',
    ]),
    summary: sentence,
    claims: z
      .array(z.object({ text: short, quotation: short }).strict())
      .max(12),
    findings: z
      .array(
        z
          .object({
            id: short,
            category,
            title: short,
            severity,
            explanation: sentence,
            quotation: short,
            uncertainty,
          })
          .strict(),
      )
      .max(12),
    missingInformation: z.array(short).max(10),
    uncertaintyIndicators: z.array(short).max(10),
    recommendedActions: z.array(sentence).max(10),
    limitations: z.array(sentence).max(8),
  })
  .strict();

export type AnalyzeRequest = z.infer<typeof analyzeRequest>;
export type ModelAnalysis = z.infer<typeof modelAnalysis>;

// Groq strict structured output requires every property and additionalProperties:false.
const str = { type: 'string' };
const arr = (items: object) => ({ type: 'array', items });
const obj = (properties: Record<string, object>) => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const en = (values: readonly string[]) => ({ type: 'string', enum: values });
export const groqSchema = obj({
  opportunityType: en(modelAnalysis.shape.opportunityType.options),
  summary: str,
  claims: arr(obj({ text: str, quotation: str })),
  findings: arr(
    obj({
      id: str,
      category: en(category.options),
      title: str,
      severity: en(severity.options),
      explanation: str,
      quotation: str,
      uncertainty: en(uncertainty.options),
    }),
  ),
  missingInformation: arr(str),
  uncertaintyIndicators: arr(str),
  recommendedActions: arr(str),
  limitations: arr(str),
});
