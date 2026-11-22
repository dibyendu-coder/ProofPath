import { describe, expect, it } from 'vitest';
import { extractImageText } from '../ocr-extract.js';

const image = { format: 'png', width: 1, height: 1 } as const;
const bytes = Buffer.from('test');

describe('OCR process isolation', () => {
  it('contains a worker crash', async () => {
    await expect(
      extractImageText(bytes, image, undefined, {
        workerUrl: new URL('./fixtures/pdf-crash.mjs', import.meta.url),
      }),
    ).rejects.toMatchObject({ code: 'ocr_processing_failed', status: 500 });
  });

  it('terminates a stalled worker at its timeout', async () => {
    await expect(
      extractImageText(bytes, image, undefined, {
        workerUrl: new URL('./fixtures/pdf-hang.mjs', import.meta.url),
        timeoutMs: 100,
      }),
    ).rejects.toMatchObject({ code: 'ocr_timeout', status: 422 });
  });

  it('terminates work when the client aborts', async () => {
    const abort = new AbortController();
    const pending = extractImageText(bytes, image, abort.signal, {
      workerUrl: new URL('./fixtures/pdf-hang.mjs', import.meta.url),
      timeoutMs: 5_000,
    });
    abort.abort();
    await expect(pending).rejects.toMatchObject({ code: 'cancelled' });
  });
});
