import { z } from 'zod';

const sourceType = z.enum(['text', 'url', 'image', 'pdf']);
const extractionMethod = z.enum([
  'user_supplied',
  'html_text',
  'plain_text',
  'image_ocr',
  'pdf_text',
  'none',
]);

export const processedSourceSchema = z
  .object({
    status: z.literal('prepared'),
    caseId: z.uuid(),
    sourceType,
    submittedAt: z.iso.datetime(),
    processingStatus: z.enum([
      'supplied',
      'extracted',
      'partial',
      'unavailable',
      'failed',
    ]),
    extractionMethod,
    extractedText: z.string().max(20_000).optional(),
    metadata: z
      .object({
        characterCount: z.number().int().nonnegative().optional(),
        normalizedUrl: z.string().optional(),
        fileName: z.string().optional(),
        fileSize: z.number().int().nonnegative().optional(),
        format: z.enum(['png', 'jpeg', 'webp', 'pdf']).optional(),
        width: z.number().int().positive().optional(),
        height: z.number().int().positive().optional(),
        pageCount: z.number().int().positive().optional(),
        pageTitle: z.string().optional(),
      })
      .strict(),
    warnings: z.array(z.string()),
    errors: z.array(z.string()),
    provenance: z
      .object({
        sourceType,
        origin: z.enum([
          'user_supplied',
          'retrieved',
          'extracted',
          'not_extracted',
        ]),
        extractionMethod,
        originalUrl: z.string().optional(),
        finalUrl: z.string().optional(),
        retrievedAt: z.iso.datetime().optional(),
        extractedAt: z.iso.datetime().optional(),
        redirectHistory: z.array(z.string()).optional(),
        pageNumbers: z.array(z.number().int().positive()).optional(),
      })
      .strict(),
  })
  .strict();
