import type { IntakeSuccess } from '../../shared/contracts.js';
import { processImage } from './image.js';
import { processPdf } from './pdf.js';
import { processedSourceSchema } from './schema.js';
import { processText } from './text.js';
import { processUrl, type UrlDependencies } from './url-fetch.js';

export type SourceInput =
  | { sourceType: 'text'; text: string }
  | { sourceType: 'url'; url: string }
  | { sourceType: 'image'; bytes: Buffer; fileName: string }
  | { sourceType: 'pdf'; bytes: Buffer; fileName: string };

export async function processSource(
  input: SourceInput,
  caseId: string,
  submittedAt: string,
  signal?: AbortSignal,
  urlDependencies?: UrlDependencies,
): Promise<IntakeSuccess> {
  let result: IntakeSuccess;
  switch (input.sourceType) {
    case 'text':
      result = processText(input.text, caseId, submittedAt);
      break;
    case 'url':
      result = await processUrl(
        input.url,
        caseId,
        submittedAt,
        signal,
        urlDependencies,
      );
      break;
    case 'image':
      result = await processImage(
        input.bytes,
        input.fileName,
        caseId,
        submittedAt,
        signal,
      );
      break;
    case 'pdf':
      result = await processPdf(
        input.bytes,
        input.fileName,
        caseId,
        submittedAt,
        signal,
      );
      break;
  }
  return processedSourceSchema.parse(result) as IntakeSuccess;
}
