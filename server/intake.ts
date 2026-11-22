import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type {
  IntakeFailure,
  IntakeSuccess,
  SourceType,
} from '../shared/contracts.js';
import { processSource } from './processing/process-source.js';
import type { UrlDependencies } from './processing/url-fetch.js';
import {
  IntakeError,
  MAX_IMAGE_BYTES,
  MAX_JSON_BYTES,
  MAX_PDF_BYTES,
  jsonRequest,
  safeFileName,
} from './intake-validation.js';

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 12;
const MAX_CONCURRENT_INTAKES = 2;

function sendJson(
  response: ServerResponse,
  status: number,
  payload: IntakeSuccess | IntakeFailure,
) {
  if (response.destroyed || response.writableEnded) return;
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(JSON.stringify(payload));
}

export function sendIntakeError(response: ServerResponse, error: unknown) {
  const known =
    error instanceof IntakeError
      ? error
      : new IntakeError(
          500,
          'server_error',
          'The source could not be prepared. Please try again.',
        );
  sendJson(response, known.status, {
    status: 'failed',
    code: known.code,
    message: known.message,
    ...(known.code === 'pdf_scanned'
      ? {
          processingStatus: 'unavailable' as const,
          warnings: [
            'No selectable PDF text was found. OCR is required for this document.',
          ],
        }
      : {}),
  });
}

async function readBody(
  request: IncomingMessage,
  maximum: number,
): Promise<Buffer> {
  const contentLength = request.headers['content-length'];
  if (
    contentLength &&
    (!/^\d+$/.test(contentLength) || Number(contentLength) > maximum)
  ) {
    throw new IntakeError(
      413,
      'request_too_large',
      'The submitted source exceeds its size limit.',
    );
  }
  const parts: Buffer[] = [];
  let total = 0;
  for await (const part of request) {
    const chunk = Buffer.isBuffer(part) ? part : Buffer.from(part);
    total += chunk.length;
    if (total > maximum)
      throw new IntakeError(
        413,
        'request_too_large',
        'The submitted source exceeds its size limit.',
      );
    parts.push(chunk);
  }
  if (total === 0)
    throw new IntakeError(
      422,
      'empty_source',
      'Choose or enter a source before submitting.',
    );
  return Buffer.concat(parts, total);
}

export function createIntakeHandler(
  options: { urlDependencies?: UrlDependencies } = {},
) {
  const visits = new Map<string, number[]>();
  let activeIntakes = 0;
  let activeHeavy = 0;

  return async (request: IncomingMessage, response: ServerResponse) => {
    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST');
      sendIntakeError(
        response,
        new IntakeError(
          405,
          'method_not_allowed',
          'Use POST to submit a source.',
        ),
      );
      return;
    }
    const client = request.socket.remoteAddress ?? 'unknown';
    const now = Date.now();
    if (visits.size >= 1_000) {
      for (const [key, times] of visits)
        if (times.every((time) => now - time >= WINDOW_MS)) visits.delete(key);
      if (visits.size >= 1_000 && !visits.has(client)) {
        const oldest = visits.keys().next().value;
        if (oldest) visits.delete(oldest);
      }
    }
    const recent = (visits.get(client) ?? []).filter(
      (time) => now - time < WINDOW_MS,
    );
    if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
      response.setHeader('Retry-After', '60');
      sendIntakeError(
        response,
        new IntakeError(
          429,
          'rate_limited',
          'Too many submissions. Please wait a minute and try again.',
        ),
      );
      return;
    }
    recent.push(now);
    visits.set(client, recent);
    if (activeIntakes >= MAX_CONCURRENT_INTAKES) {
      sendIntakeError(
        response,
        new IntakeError(
          503,
          'server_busy',
          'The intake is busy. Please try again shortly.',
        ),
      );
      return;
    }

    activeIntakes++;
    const abort = new AbortController();
    const onClose = () => {
      if (!response.writableFinished) abort.abort();
    };
    response.on('close', onClose);

    try {
      if (
        request.headers['content-encoding'] &&
        request.headers['content-encoding'] !== 'identity'
      ) {
        throw new IntakeError(
          415,
          'unsupported_encoding',
          'Compressed request bodies are not supported.',
        );
      }
      const submittedAt = new Date().toISOString();
      const caseId = randomUUID();
      const contentType = request.headers['content-type']
        ?.split(';')[0]
        ?.toLowerCase();
      let result: IntakeSuccess;

      if (contentType === 'application/json') {
        const body = await readBody(request, MAX_JSON_BYTES);
        let parsed: unknown;
        try {
          parsed = JSON.parse(body.toString('utf8'));
        } catch {
          throw new IntakeError(
            400,
            'malformed_json',
            'The request is not valid JSON.',
          );
        }
        const input = jsonRequest.safeParse(parsed);
        if (!input.success)
          throw new IntakeError(
            422,
            'invalid_request',
            'Provide a text or URL source using the documented fields.',
          );

        result = await processSource(
          input.data,
          caseId,
          submittedAt,
          abort.signal,
          options.urlDependencies,
        );
      } else if (contentType === 'application/octet-stream') {
        const sourceType = request.headers['x-source-type'] as
          SourceType | undefined;
        if (sourceType !== 'image' && sourceType !== 'pdf')
          throw new IntakeError(
            422,
            'invalid_source_type',
            'Choose image or PDF for a file submission.',
          );
        const maximum =
          sourceType === 'image' ? MAX_IMAGE_BYTES : MAX_PDF_BYTES;
        const rawName = request.headers['x-file-name'];
        if (Array.isArray(rawName))
          throw new IntakeError(
            400,
            'invalid_filename',
            'The file name could not be read.',
          );
        const fileName = safeFileName(
          rawName,
          sourceType === 'image' ? 'image' : 'document.pdf',
        );
        const body = await readBody(request, maximum);

        if (activeHeavy >= 1)
          throw new IntakeError(
            503,
            'processing_busy',
            'Another document is being prepared. Please try again shortly.',
          );
        activeHeavy++;
        try {
          result = await processSource(
            { sourceType, bytes: body, fileName },
            caseId,
            submittedAt,
            abort.signal,
            options.urlDependencies,
          );
        } finally {
          activeHeavy--;
        }
      } else {
        throw new IntakeError(
          415,
          'unsupported_content_type',
          'Use JSON for text or URLs, or binary upload for images and PDFs.',
        );
      }
      sendJson(response, 201, result);
    } catch (error) {
      sendIntakeError(response, error);
    } finally {
      activeIntakes--;
      response.off('close', onClose);
    }
  };
}
