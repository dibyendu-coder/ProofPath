import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

type PdfWorkerResult =
  | {
      ok: true;
      text: string;
      pageCount: number;
      pageNumbers: number[];
      blankPages: number[];
    }
  | { ok: false; code: string; message: string };

async function parsePdf(bytes: Uint8Array): Promise<PdfWorkerResult> {
  const task = getDocument({
    data: bytes,
    isEvalSupported: false,
    stopAtErrors: true,
    useWorkerFetch: false,
    enableXfa: false,
    verbosity: 0,
  });
  try {
    const document = await task.promise;
    if (document.numPages > 15)
      return {
        ok: false,
        code: 'pdf_page_limit',
        message: 'PDFs must contain 15 pages or fewer.',
      };
    let text = '';
    const pageNumbers: number[] = [];
    const blankPages: number[] = [];
    for (let number = 1; number <= document.numPages; number++) {
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      let pageText = '';
      for (const item of content.items) {
        if ('str' in item) pageText += item.str + (item.hasEOL ? '\n' : ' ');
        if (text.length + pageText.length > 20_000)
          return {
            ok: false,
            code: 'pdf_text_limit',
            message:
              'This PDF contains more than 20,000 extractable characters. Submit a shorter document.',
          };
      }
      page.cleanup();
      if (pageText.trim()) {
        pageNumbers.push(number);
        const separator = text ? '\n\n' : '';
        if (text.length + separator.length + pageText.trim().length > 20_000)
          return {
            ok: false,
            code: 'pdf_text_limit',
            message:
              'This PDF contains more than 20,000 extractable characters. Submit a shorter document.',
          };
        text += `${separator}${pageText.trim()}`;
      } else blankPages.push(number);
    }
    text = text.trim();
    if (!text)
      return {
        ok: false,
        code: 'pdf_scanned',
        message:
          'This PDF has no extractable text. Scanned PDFs need OCR, which is not available yet.',
      };
    return {
      ok: true,
      text,
      pageCount: document.numPages,
      pageNumbers,
      blankPages,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'PasswordException')
      return {
        ok: false,
        code: 'pdf_encrypted',
        message: 'Password-protected PDFs are not supported.',
      };
    return {
      ok: false,
      code: 'invalid_pdf',
      message: 'This PDF is malformed or uses an unsupported feature.',
    };
  } finally {
    await task.destroy();
  }
}

process.once('message', (bytes: Buffer) => {
  parsePdf(new Uint8Array(bytes))
    .catch(
      () =>
        ({
          ok: false,
          code: 'invalid_pdf',
          message: 'This PDF could not be processed.',
        }) satisfies PdfWorkerResult,
    )
    .then((result) => process.send?.(result, () => process.exit(0)));
});
