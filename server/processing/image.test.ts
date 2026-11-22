import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { processImage } from './image.js';

const caseId = '74125c6d-3480-43f0-9fab-e63e93b84b11';
const submittedAt = '2026-11-22T00:00:00.000Z';
const sample = () =>
  readFile(new URL('./fixtures/ocr-sample.png', import.meta.url));

function pngHeader(width: number, height: number): Buffer {
  const bytes = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes);
  bytes.write('IHDR', 12, 'ascii');
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
}

describe('screenshot processing', () => {
  it.each(['png', 'jpeg', 'webp'] as const)(
    'extracts real text from a valid %s screenshot',
    async (format) => {
      const decoder = sharp(await sample());
      const bytes = await decoder[format]().toBuffer();
      const result = await processImage(
        bytes,
        `offer.${format}`,
        caseId,
        submittedAt,
      );
      expect(result.processingStatus).toBe('extracted');
      expect(result.extractionMethod).toBe('image_ocr');
      expect(result.extractedText).toContain('Frontend Engineering Internship');
      expect(result.extractedText).toContain('Verification payment 1,499');
      expect(result.extractedText).toContain('Deadline: 30 minutes');
      expect(result.extractedText).toContain('maya.recruiter@example.org');
      expect(result.metadata).toMatchObject({
        format,
        width: 1200,
        height: 280,
      });
      expect(result.warnings[0]).toMatch(/may misread/i);
      expect(result.provenance?.origin).toBe('extracted');
    },
    20_000,
  );

  it('rejects truncated PNG data and malformed JPEG with client errors', async () => {
    await expect(
      processImage(pngHeader(800, 240), 'truncated.png', caseId, submittedAt),
    ).rejects.toMatchObject({ status: 422, code: 'invalid_image' });
    await expect(
      processImage(
        Buffer.from([0xff, 0xd8, 0xff, 0xff, 0xff, 0xff, 0xff]),
        'broken.jpeg',
        caseId,
        submittedAt,
      ),
    ).rejects.toMatchObject({ status: 422, code: 'invalid_image' });
  });

  it('rejects corrupted WebP and spoofed extension', async () => {
    const webp = await sharp(await sample())
      .webp()
      .toBuffer();
    await expect(
      processImage(
        webp.subarray(0, Math.floor(webp.length / 2)),
        'broken.webp',
        caseId,
        submittedAt,
      ),
    ).rejects.toMatchObject({ status: 422, code: 'invalid_image' });
    await expect(
      processImage(
        Buffer.from('not an image'),
        'offer.png',
        caseId,
        submittedAt,
      ),
    ).rejects.toMatchObject({ status: 415, code: 'unsupported_image' });
    const renamed = await processImage(
      await sample(),
      'offer.jpeg',
      caseId,
      submittedAt,
    );
    expect(renamed.metadata.format).toBe('png');
  });

  it('rejects a pixel bomb and invalid dimensions before decoding', async () => {
    await expect(
      processImage(pngHeader(6000, 6000), 'large.png', caseId, submittedAt),
    ).rejects.toMatchObject({ status: 422, code: 'image_pixel_limit' });
    await expect(
      processImage(pngHeader(0, 10), 'zero.png', caseId, submittedAt),
    ).rejects.toMatchObject({ status: 422, code: 'invalid_image' });
  });
});
