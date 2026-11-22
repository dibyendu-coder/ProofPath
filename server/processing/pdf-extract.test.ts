import { describe, expect, it } from 'vitest';
import { extractPdf } from '../pdf-extract.js';

describe('PDF parser isolation', () => {
  it('returns a safe error when the parser process crashes', async () => {
    await expect(
      extractPdf(Buffer.from('%PDF-'), undefined, {
        workerUrl: new URL('./fixtures/pdf-crash.mjs', import.meta.url),
      }),
    ).rejects.toMatchObject({ code: 'pdf_processing_failed' });
  });

  it('terminates a parser that exceeds its deadline', async () => {
    await expect(
      extractPdf(Buffer.from('%PDF-'), undefined, {
        workerUrl: new URL('./fixtures/pdf-hang.mjs', import.meta.url),
        timeoutMs: 100,
      }),
    ).rejects.toMatchObject({ code: 'pdf_timeout' });
  });

  it('cancels a pending parser', async () => {
    const abort = new AbortController();
    abort.abort();
    await expect(
      extractPdf(Buffer.from('%PDF-'), abort.signal, {
        workerUrl: new URL('./fixtures/pdf-hang.mjs', import.meta.url),
      }),
    ).rejects.toMatchObject({ code: 'cancelled' });
  });
});
