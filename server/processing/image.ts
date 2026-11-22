import type { IntakeSuccess } from '../../shared/contracts.js';
import { inspectImage } from '../image-metadata.js';
import { extractImageText } from '../ocr-extract.js';
import { IntakeError } from '../intake-validation.js';

const MAX_PIXELS = 12_000_000;

export async function processImage(
  bytes: Buffer,
  fileName: string,
  caseId: string,
  submittedAt: string,
  signal?: AbortSignal,
): Promise<IntakeSuccess> {
  let image;
  try {
    image = inspectImage(bytes);
  } catch (error) {
    if (error instanceof IntakeError) throw error;
    throw new IntakeError(422, 'invalid_image', 'The image is malformed.');
  }
  if (image.width * image.height > MAX_PIXELS)
    throw new IntakeError(
      422,
      'image_pixel_limit',
      'Images must contain 12 megapixels or fewer.',
    );
  const extracted = await extractImageText(bytes, image, signal);
  const text = extracted.text.replace(/\r\n?/g, '\n').trim();
  const partial = text.length > 20_000;
  const warnings = [
    'OCR may misread small text, currency symbols, and contact details. Check the screenshot before relying on this text.',
  ];
  if (partial)
    warnings.push(
      'OCR text exceeded 20,000 characters; only the first 20,000 are shown.',
    );
  if (extracted.width !== image.width || extracted.height !== image.height)
    warnings.push('The image was resized or rotated before OCR.');
  return {
    status: 'prepared',
    caseId,
    sourceType: 'image',
    submittedAt,
    processingStatus: partial ? 'partial' : 'extracted',
    extractionMethod: 'image_ocr',
    extractedText: text.slice(0, 20_000),
    metadata: {
      fileName,
      fileSize: bytes.length,
      ...image,
      characterCount: Math.min(text.length, 20_000),
    },
    warnings,
    errors: [],
    provenance: {
      sourceType: 'image',
      origin: 'extracted',
      extractionMethod: 'image_ocr',
      extractedAt: new Date().toISOString(),
    },
  };
}
