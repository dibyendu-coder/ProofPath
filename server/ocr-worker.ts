import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';
import type { ImageMetadata } from './image-metadata.js';

type OcrWorkerResult =
  | { ok: true; text: string; width: number; height: number }
  | { ok: false; code: string; message: string };

const require = createRequire(import.meta.url);
const languagePath = join(
  dirname(require.resolve('@tesseract.js-data/eng')),
  '4.0.0_best_int',
);
const MAX_PIXELS = 12_000_000;
const MAX_RSS_BYTES = 160 * 1024 * 1024;

sharp.cache(false);
sharp.concurrency(1);

async function recognizeImage(
  bytes: Buffer,
  expected: ImageMetadata,
): Promise<OcrWorkerResult> {
  let normalized: Buffer;
  let width: number;
  let height: number;
  try {
    const metadata = await sharp(bytes, {
      failOn: 'warning',
      limitInputPixels: MAX_PIXELS,
      pages: 1,
    }).metadata();
    if (
      metadata.format !== expected.format ||
      metadata.width !== expected.width ||
      metadata.height !== expected.height ||
      (metadata.pages ?? 1) !== 1
    ) {
      return {
        ok: false,
        code: 'invalid_image',
        message: 'The image could not be validated.',
      };
    }
    const decoded = await sharp(bytes, {
      failOn: 'warning',
      limitInputPixels: MAX_PIXELS,
      pages: 1,
    })
      .rotate()
      .resize({
        width: 1_600,
        height: 1_600,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .png()
      .toBuffer({ resolveWithObject: true });
    normalized = decoded.data;
    width = decoded.info.width;
    height = decoded.info.height;
  } catch {
    return {
      ok: false,
      code: 'invalid_image',
      message: 'The image is incomplete or malformed.',
    };
  }

  try {
    const worker = await createWorker('eng', 1, {
      langPath: languagePath,
      cacheMethod: 'none',
    });
    try {
      const result = await worker.recognize(normalized);
      const text = result.data.text.trim();
      if (!text)
        return {
          ok: false,
          code: 'ocr_no_text',
          message: 'No readable text was found in this screenshot.',
        };
      return { ok: true, text, width, height };
    } finally {
      await worker.terminate();
    }
  } catch {
    return {
      ok: false,
      code: 'ocr_failed',
      message: 'Screenshot text extraction failed.',
    };
  }
}

process.once(
  'message',
  ({ bytes, expected }: { bytes: Buffer; expected: ImageMetadata }) => {
    let finished = false;
    let peakRssBytes = process.memoryUsage().rss;
    const send = (result: OcrWorkerResult) => {
      if (finished) return;
      finished = true;
      clearInterval(memoryWatch);
      peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss);
      process.send?.({ ...result, peakRssBytes }, () => process.exit(0));
    };
    const memoryWatch = setInterval(() => {
      peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss);
      if (peakRssBytes > MAX_RSS_BYTES)
        send({
          ok: false,
          code: 'ocr_memory_limit',
          message: 'This screenshot requires too much memory to process.',
        });
    }, 20);
    recognizeImage(bytes, expected)
      .then(send)
      .catch(() =>
        send({
          ok: false,
          code: 'ocr_failed',
          message: 'Screenshot text extraction failed.',
        }),
      );
  },
);
