import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import sharp from 'sharp';
import { createApp } from './app.js';
import { createIntakeHandler } from './intake.js';

let server: Server;
let base: string;

beforeEach(async () => {
  server = createApp(
    'dist',
    createIntakeHandler({
      urlDependencies: {
        resolve: async () => {
          throw new Error('DNS unavailable in tests');
        },
        request: async () => {
          throw new Error('Unexpected network request');
        },
      },
    }),
  );
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('No TCP address');
  base = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function json(body: unknown) {
  return fetch(`${base}/api/intake`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function expectJsonFailure(
  response: Response,
  status: number,
  code: string,
) {
  expect(response.status).toBe(status);
  expect(response.headers.get('content-type')).toMatch(/^application\/json/);
  const raw = await response.text();
  expect(raw.length).toBeGreaterThan(0);
  expect(JSON.parse(raw)).toMatchObject({ status: 'failed', code });
}

function upload(type: 'image' | 'pdf', name: string, bytes: Buffer) {
  return fetch(`${base}/api/intake`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-Source-Type': type,
      'X-File-Name': encodeURIComponent(name),
    },
    body: new Uint8Array(bytes),
  });
}

function makePdf(text?: string): Buffer {
  return makePdfPages([text ?? '']);
}

function makePdfPages(pageTexts: string[]): Buffer {
  const pageIds = pageTexts.map((_, index) => 3 + index * 2);
  const fontId = 3 + pageTexts.length * 2;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageTexts.length} >>`,
  ];
  for (const [index, text] of pageTexts.entries()) {
    const content = text
      ? `BT /F1 14 Tf 72 720 Td (${text.replace(/[()\\]/g, '\\$&')}) Tj ET`
      : '';
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${pageIds[index] + 1} 0 R >>`,
    );
    objects.push(
      `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    );
  }
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1))
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Root 1 0 R /Size ${objects.length + 1} >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'utf8');
}

function makeBinaryPdf(objects: Buffer[], extraTrailer = ''): Buffer {
  const parts = [Buffer.from('%PDF-1.4\n')];
  const offsets = [0];
  let position = parts[0].length;
  for (const [index, object] of objects.entries()) {
    offsets.push(position);
    const part = Buffer.concat([
      Buffer.from(`${index + 1} 0 obj\n`),
      object,
      Buffer.from('\nendobj\n'),
    ]);
    parts.push(part);
    position += part.length;
  }
  let trailer = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1))
    trailer += `${String(offset).padStart(10, '0')} 00000 n \n`;
  trailer += `trailer\n<< /Root 1 0 R /Size ${objects.length + 1}${extraTrailer} >>\nstartxref\n${position}\n%%EOF\n`;
  return Buffer.concat([...parts, Buffer.from(trailer)]);
}

describe('opportunity intake', () => {
  it('prepares valid text without storing a risk result', async () => {
    const response = await json({
      sourceType: 'text',
      text: 'A remote internship offer.',
    });
    expect(response.status).toBe(201);
    expect(response.headers.get('content-type')).toMatch(/^application\/json/);
    const result = await response.json();
    expect(result).toMatchObject({
      status: 'prepared',
      sourceType: 'text',
      extractedText: 'A remote internship offer.',
      metadata: { characterCount: 26 },
      warnings: [],
    });
    expect(result.caseId).toMatch(/^[\da-f-]{36}$/);
    expect(result).not.toHaveProperty('riskScore');
  });

  it('rejects whitespace text and malformed requests', async () => {
    expect((await json({ sourceType: 'text', text: '  \n ' })).status).toBe(
      422,
    );
    expect(
      (await json({ sourceType: 'text', text: 'x'.repeat(20_001) })).status,
    ).toBe(413);
    expect(
      (await json({ sourceType: 'text', content: 'wrong field' })).status,
    ).toBe(422);
    const malformed = await fetch(`${base}/api/intake`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    });
    await expectJsonFailure(malformed, 400, 'malformed_json');
    await expectJsonFailure(
      await json({ sourceType: 'text', text: 'x'.repeat(100_001) }),
      413,
      'request_too_large',
    );
  });

  it('normalizes HTTP URLs but does not fetch their contents', async () => {
    const response = await json({
      sourceType: 'url',
      url: 'HTTPS://Example.COM:443/jobs#apply',
    });
    expect(response.status).toBe(201);
    const result = await response.json();
    expect(result.metadata.normalizedUrl).toBe('https://example.com/jobs');
    expect(result.extractedText).toBeUndefined();
    expect(result.warnings[0]).toMatch(/not been retrieved/i);
    expect((await json({ sourceType: 'url', url: 'not a url' })).status).toBe(
      422,
    );
    expect(
      (await json({ sourceType: 'url', url: 'https://user:pass@example.com' }))
        .status,
    ).toBe(422);
    expect(
      (await json({ sourceType: 'url', url: 'file:///etc/passwd' })).status,
    ).toBe(422);
  });

  it('returns retrieved URL text and provenance through the intake API', async () => {
    const retrievalServer = createApp(
      'dist',
      createIntakeHandler({
        urlDependencies: {
          resolve: async () => [{ address: '8.8.8.8', family: 4 }],
          request: async () => ({
            status: 200,
            contentType: 'text/html; charset=utf-8',
            contentEncoding: '',
            body: Buffer.from(
              '<title>Careers</title><main>Internship applications open</main>',
            ),
          }),
        },
      }),
    );
    await new Promise<void>((resolve) =>
      retrievalServer.listen(0, '127.0.0.1', resolve),
    );
    try {
      const address = retrievalServer.address();
      if (!address || typeof address === 'string') throw new Error('No port');
      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/intake`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceType: 'url',
            url: 'https://jobs.example.org/opening',
          }),
        },
      );
      expect(response.status).toBe(201);
      const result = await response.json();
      expect(result).toMatchObject({
        status: 'prepared',
        sourceType: 'url',
        processingStatus: 'extracted',
        extractionMethod: 'html_text',
        metadata: { pageTitle: 'Careers' },
      });
      expect(result.extractedText).toContain('Internship applications open');
      expect(result.provenance.origin).toBe('retrieved');
    } finally {
      await new Promise<void>((resolve) =>
        retrievalServer.close(() => resolve()),
      );
    }
  });

  it('extracts screenshot text and rejects spoofed or oversized uploads', async () => {
    const png = await readFile(
      new URL('./processing/fixtures/ocr-sample.png', import.meta.url),
    );
    const accepted = await upload('image', 'portrait.png', png);
    expect(accepted.status).toBe(201);
    const receipt = await accepted.json();
    expect(receipt.metadata).toMatchObject({
      format: 'png',
      width: 1200,
      height: 280,
    });
    expect(receipt.processingStatus).toBe('extracted');
    expect(receipt.extractionMethod).toBe('image_ocr');
    expect(receipt.extractedText).toContain('Frontend Engineering Internship');
    expect(
      (await upload('image', 'spoofed.png', Buffer.from('not an image')))
        .status,
    ).toBe(415);
    expect(
      (await upload('image', 'oversize.png', Buffer.alloc(5 * 1024 * 1024 + 1)))
        .status,
    ).toBe(413);
    const truncated = await upload(
      'image',
      'truncated.png',
      png.subarray(0, 24),
    );
    await expectJsonFailure(truncated, 422, 'invalid_image');
    const malformedJpeg = await upload(
      'image',
      'broken.jpeg',
      Buffer.from([0xff, 0xd8, 0xff, 0xff, 0xff, 0xff, 0xff]),
    );
    await expectJsonFailure(malformedJpeg, 422, 'invalid_image');
  });

  it('extracts text from a bounded PDF', async () => {
    const response = await upload(
      'pdf',
      'offer.pdf',
      makePdf('Internship offer letter'),
    );
    expect(response.status).toBe(201);
    const result = await response.json();
    expect(result.extractedText).toContain('Internship offer letter');
    expect(result.metadata).toMatchObject({ format: 'pdf', pageCount: 1 });
  });

  it('rejects invalid and image-only PDFs with clear errors', async () => {
    expect(
      (await upload('pdf', 'fake.pdf', Buffer.from('not a pdf'))).status,
    ).toBe(415);
    const blank = await upload('pdf', 'scan.pdf', makePdf());
    expect(blank.status).toBe(422);
    const failure = await blank.json();
    expect(failure.code).toBe('pdf_scanned');
    expect(failure.processingStatus).toBe('unavailable');
    expect(failure.warnings[0]).toMatch(/OCR is required/);
    await expectJsonFailure(
      await upload('pdf', 'invalid.pdf', Buffer.from('%PDF-invalid')),
      422,
      'invalid_pdf',
    );
  });

  it('recognizes an embedded-image-only PDF as scanned', async () => {
    const png = await readFile(
      new URL('./processing/fixtures/ocr-sample.png', import.meta.url),
    );
    const jpeg = await sharp(png).jpeg().toBuffer();
    const content = Buffer.from('q 1200 0 0 280 0 0 cm /Im1 Do Q');
    const pdf = makeBinaryPdf([
      Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'),
      Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
      Buffer.from(
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1200 280] /Resources << /XObject << /Im1 5 0 R >> >> /Contents 4 0 R >>',
      ),
      Buffer.concat([
        Buffer.from(`<< /Length ${content.length} >>\nstream\n`),
        content,
        Buffer.from('\nendstream'),
      ]),
      Buffer.concat([
        Buffer.from(
          `<< /Type /XObject /Subtype /Image /Width 1200 /Height 280 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
        ),
        jpeg,
        Buffer.from('\nendstream'),
      ]),
    ]);
    await expectJsonFailure(
      await upload('pdf', 'image-only.pdf', pdf),
      422,
      'pdf_scanned',
    );
  });

  it('rejects a password-protected PDF', async () => {
    const content = Buffer.from('BT /F1 12 Tf 72 720 Td (Secret) Tj ET');
    const pdf = makeBinaryPdf(
      [
        Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'),
        Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
        Buffer.from(
          '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
        ),
        Buffer.concat([
          Buffer.from(`<< /Length ${content.length} >>\nstream\n`),
          content,
          Buffer.from('\nendstream'),
        ]),
        Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'),
        Buffer.from(
          `<< /Filter /Standard /V 1 /R 2 /Length 40 /O <${'00'.repeat(32)}> /U <${'00'.repeat(32)}> /P -4 >>`,
        ),
      ],
      ' /Encrypt 6 0 R /ID [<0123456789abcdef0123456789abcdef><0123456789abcdef0123456789abcdef>]',
    );
    await expectJsonFailure(
      await upload('pdf', 'encrypted.pdf', pdf),
      422,
      'pdf_encrypted',
    );
  });

  it('marks mixed text and scanned PDF pages as partial', async () => {
    const response = await upload(
      'pdf',
      'mixed.pdf',
      makePdfPages(['Internship opening', '']),
    );
    expect(response.status).toBe(201);
    const result = await response.json();
    expect(result.processingStatus).toBe('partial');
    expect(result.provenance.pageNumbers).toEqual([1]);
    expect(result.warnings[0]).toMatch(/page.*2.*OCR/i);
  });

  it('rejects PDFs over the page limit', async () => {
    const response = await upload(
      'pdf',
      'long.pdf',
      makePdfPages(Array.from({ length: 16 }, () => 'Page text')),
    );
    await expectJsonFailure(response, 422, 'pdf_page_limit');
  });

  it('does not run PDF and OCR workers at the same time', async () => {
    const png = await readFile(
      new URL('./processing/fixtures/ocr-sample.png', import.meta.url),
    );
    const imageRequest = upload('image', 'offer.png', png);
    await new Promise((resolve) => setTimeout(resolve, 50));
    await expectJsonFailure(
      await upload('pdf', 'offer.pdf', makePdf('Internship offer')),
      503,
      'processing_busy',
    );
    expect((await imageRequest).status).toBe(201);
  });

  it('reports unsupported file requests and methods', async () => {
    const unsupported = await fetch(`${base}/api/intake`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'hello',
    });
    await expectJsonFailure(unsupported, 415, 'unsupported_content_type');
    await expectJsonFailure(
      await fetch(`${base}/api/intake`),
      405,
      'method_not_allowed',
    );
    await expectJsonFailure(
      await json({ sourceType: 'video', url: 'https://example.com' }),
      422,
      'invalid_request',
    );
  });

  it('returns safe JSON if an intake handler fails unexpectedly', async () => {
    const failingServer = createApp('dist', async () => {
      throw new Error('Private internal detail');
    });
    await new Promise<void>((resolve) =>
      failingServer.listen(0, '127.0.0.1', resolve),
    );
    try {
      const address = failingServer.address();
      if (!address || typeof address === 'string')
        throw new Error('No TCP address');
      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/intake`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceType: 'text', text: 'Offer text' }),
        },
      );
      expect(response.status).toBe(500);
      expect(response.headers.get('content-type')).toMatch(
        /^application\/json/,
      );
      const raw = await response.text();
      expect(raw).not.toContain('Private internal detail');
      expect(JSON.parse(raw)).toMatchObject({
        status: 'failed',
        code: 'server_error',
      });
    } finally {
      await new Promise<void>((resolve) =>
        failingServer.close(() => resolve()),
      );
    }
  });
});
