import type { IntakeSuccess } from '../../shared/contracts.js';
import { isPdf } from '../image-metadata.js';
import { IntakeError } from '../intake-validation.js';
import { extractPdf } from '../pdf-extract.js';

export async function processPdf(
  bytes: Buffer,
  fileName: string,
  caseId: string,
  submittedAt: string,
  signal?: AbortSignal,
): Promise<IntakeSuccess> {
  if (!isPdf(bytes))
    throw new IntakeError(
      415,
      'invalid_pdf_signature',
      'Upload a valid PDF document.',
    );
  const extracted = await extractPdf(bytes, signal);
  const warnings = extracted.blankPages.length
    ? [
        `Pages ${extracted.blankPages.join(', ')} had no selectable text; OCR may be required.`,
      ]
    : [];
  return {
    status: 'prepared',
    caseId,
    sourceType: 'pdf',
    submittedAt,
    processingStatus: warnings.length ? 'partial' : 'extracted',
    extractionMethod: 'pdf_text',
    extractedText: extracted.text,
    metadata: {
      fileName,
      fileSize: bytes.length,
      format: 'pdf',
      pageCount: extracted.pageCount,
      characterCount: extracted.text.length,
    },
    warnings,
    errors: [],
    provenance: {
      sourceType: 'pdf',
      origin: 'extracted',
      extractionMethod: 'pdf_text',
      extractedAt: new Date().toISOString(),
      pageNumbers: extracted.pageNumbers,
    },
  };
}
