import type { IntakeSuccess } from '../../shared/contracts.js';
import { normalizeSubmittedText } from './normalize.js';

export function processText(
  text: string,
  caseId: string,
  submittedAt: string,
): IntakeSuccess {
  const normalized = normalizeSubmittedText(text);
  const extractedAt = new Date().toISOString();
  return {
    status: 'prepared',
    caseId,
    sourceType: 'text',
    submittedAt,
    processingStatus: 'supplied',
    extractionMethod: 'user_supplied',
    extractedText: normalized.text,
    metadata: { characterCount: normalized.text.length },
    warnings: normalized.changed
      ? [
          'Nonprinting characters, line endings, or excess whitespace were normalized.',
        ]
      : [],
    errors: [],
    provenance: {
      sourceType: 'text',
      origin: 'user_supplied',
      extractionMethod: 'user_supplied',
      extractedAt,
    },
  };
}
