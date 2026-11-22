import http from 'node:http';
import https from 'node:https';
import type { LookupFunction } from 'node:net';
import { brotliDecompressSync, gunzipSync, inflateSync } from 'node:zlib';
import type { IntakeSuccess } from '../../shared/contracts.js';
import { IntakeError, normalizeUrl } from '../intake-validation.js';
import { extractHtml, extractPlainText } from './html.js';
import {
  resolveAddresses,
  validateResolvedAddresses,
  validateRetrievalUrl,
  type ResolvedAddress,
} from './url-security.js';

const MAX_ENCODED_BYTES = 1_000_000;
const MAX_DECODED_BYTES = 2_000_000;
const TOTAL_TIMEOUT_MS = 8_000;
const CONNECT_TIMEOUT_MS = 3_000;
const MAX_REDIRECTS = 3;

type PageResponse = {
  status: number;
  contentType: string;
  contentEncoding: string;
  location?: string;
  body: Buffer;
};
export type UrlDependencies = {
  resolve: (hostname: string) => Promise<ResolvedAddress[]>;
  request: (
    url: URL,
    address: ResolvedAddress,
    deadline: number,
    signal?: AbortSignal,
  ) => Promise<PageResponse>;
};

class RetrievalError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

function decodeBody(body: Buffer, encoding: string): Buffer {
  try {
    switch (encoding) {
      case '':
      case 'identity':
        return body;
      case 'gzip':
        return gunzipSync(body, { maxOutputLength: MAX_DECODED_BYTES });
      case 'deflate':
        return inflateSync(body, { maxOutputLength: MAX_DECODED_BYTES });
      case 'br':
        return brotliDecompressSync(body, {
          maxOutputLength: MAX_DECODED_BYTES,
        });
      default:
        throw new RetrievalError(
          'unsupported_encoding',
          'The webpage uses an unsupported compression format.',
        );
    }
  } catch (error) {
    if (error instanceof RetrievalError) throw error;
    if (
      error instanceof Error &&
      'code' in error &&
      error.code === 'ERR_BUFFER_TOO_LARGE'
    ) {
      throw new RetrievalError(
        'response_too_large',
        'The webpage is too large to process safely.',
      );
    }
    throw new RetrievalError(
      'invalid_encoding',
      'The webpage could not be decompressed safely.',
    );
  }
}

export function requestPinned(
  url: URL,
  address: ResolvedAddress,
  deadline: number,
  signal?: AbortSignal,
  testTls?: { ca: Buffer },
): Promise<PageResponse> {
  return new Promise((resolve, reject) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      reject(
        new RetrievalError('retrieval_timeout', 'Webpage retrieval timed out.'),
      );
      return;
    }
    const pinnedLookup: LookupFunction = (_hostname, options, callback) => {
      if (typeof options === 'object' && options.all) {
        (callback as (error: null, addresses: ResolvedAddress[]) => void)(
          null,
          [address],
        );
      } else {
        (callback as (error: null, address: string, family: number) => void)(
          null,
          address.address,
          address.family,
        );
      }
    };
    const transport = url.protocol === 'https:' ? https : http;
    const request = transport.request(
      url,
      {
        method: 'GET',
        agent: false,
        lookup: pinnedLookup,
        servername: url.hostname,
        ca: testTls?.ca,
        maxHeaderSize: 16_384,
        headers: {
          Accept: 'text/html,text/plain;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'User-Agent': 'ProofPath-SourceProcessor/1.0',
        },
      },
      async (response) => {
        try {
          const status = response.statusCode ?? 0;
          const contentType = String(
            response.headers['content-type'] ?? '',
          ).toLowerCase();
          const contentEncoding = String(
            response.headers['content-encoding'] ?? '',
          )
            .toLowerCase()
            .trim();
          const location =
            typeof response.headers.location === 'string'
              ? response.headers.location
              : undefined;
          if (
            (status >= 300 && status < 400) ||
            status !== 200 ||
            !/^(text\/html|text\/plain)(?:;|$)/.test(contentType)
          ) {
            response.destroy();
            finish(undefined, {
              status,
              contentType,
              contentEncoding,
              location,
              body: Buffer.alloc(0),
            });
            return;
          }
          const length = Number(response.headers['content-length'] ?? 0);
          if (length > MAX_ENCODED_BYTES)
            throw new RetrievalError(
              'response_too_large',
              'The webpage is too large to process safely.',
            );
          const chunks: Buffer[] = [];
          let total = 0;
          for await (const part of response) {
            const chunk = Buffer.isBuffer(part) ? part : Buffer.from(part);
            total += chunk.length;
            if (total > MAX_ENCODED_BYTES)
              throw new RetrievalError(
                'response_too_large',
                'The webpage is too large to process safely.',
              );
            chunks.push(chunk);
          }
          const body = decodeBody(
            Buffer.concat(chunks, total),
            contentEncoding,
          );
          if (body.length > MAX_DECODED_BYTES)
            throw new RetrievalError(
              'response_too_large',
              'The webpage is too large to process safely.',
            );
          finish(undefined, {
            status,
            contentType,
            contentEncoding,
            location,
            body,
          });
        } catch (error) {
          request.destroy();
          finish(
            error instanceof Error ? error : new Error('Retrieval failed'),
          );
        }
      },
    );
    let finished = false;
    const finish = (error?: Error, result?: PageResponse) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      if (error) reject(error);
      else if (result) resolve(result);
    };
    const onAbort = () =>
      request.destroy(
        new RetrievalError('cancelled', 'Webpage retrieval cancelled.'),
      );
    const timer = setTimeout(
      () =>
        request.destroy(
          new RetrievalError(
            'retrieval_timeout',
            'Webpage retrieval timed out.',
          ),
        ),
      remaining,
    );
    request.setTimeout(Math.min(CONNECT_TIMEOUT_MS, remaining), () =>
      request.destroy(
        new RetrievalError('retrieval_timeout', 'Webpage retrieval timed out.'),
      ),
    );
    request.on('error', (error) => finish(error));
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) {
      onAbort();
      return;
    }
    request.end();
  });
}

const defaultDependencies: UrlDependencies = {
  resolve: resolveAddresses,
  request: requestPinned,
};

function withinDeadline<T>(
  operation: Promise<T>,
  deadline: number,
  signal?: AbortSignal,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      reject(
        new RetrievalError('retrieval_timeout', 'Webpage retrieval timed out.'),
      );
      return;
    }
    const timer = setTimeout(
      () =>
        finish(
          new RetrievalError(
            'retrieval_timeout',
            'Webpage retrieval timed out.',
          ),
        ),
      remaining,
    );
    const onAbort = () =>
      finish(new RetrievalError('cancelled', 'Webpage retrieval cancelled.'));
    const finish = (error?: Error, result?: T) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      if (error) reject(error);
      else resolve(result as T);
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) {
      onAbort();
      return;
    }
    operation.then(
      (result) => finish(undefined, result),
      (error) =>
        finish(
          error instanceof Error ? error : new Error('DNS resolution failed'),
        ),
    );
  });
}

export async function processUrl(
  rawUrl: string,
  caseId: string,
  submittedAt: string,
  signal?: AbortSignal,
  dependencies: UrlDependencies = defaultDependencies,
): Promise<IntakeSuccess> {
  const normalizedUrl = normalizeUrl(rawUrl);
  const originalUrl = rawUrl.trim();
  let current = new URL(normalizedUrl);
  const history: string[] = [];
  const deadline = Date.now() + TOTAL_TIMEOUT_MS;
  let retrievalError: string | undefined;

  try {
    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
      validateRetrievalUrl(current);
      const addresses = await withinDeadline(
        dependencies.resolve(current.hostname),
        deadline,
        signal,
      );
      const pinned = validateResolvedAddresses(addresses);
      if (Date.now() >= deadline)
        throw new RetrievalError(
          'retrieval_timeout',
          'Webpage retrieval timed out.',
        );
      const response = await dependencies.request(
        current,
        pinned,
        deadline,
        signal,
      );
      if (response.status >= 300 && response.status < 400) {
        if (!response.location || redirect === MAX_REDIRECTS)
          throw new RetrievalError(
            'redirect_limit',
            'The webpage redirected too many times or without a destination.',
          );
        history.push(current.toString());
        current = new URL(response.location, current);
        continue;
      }
      if (response.status !== 200)
        throw new RetrievalError(
          'remote_status',
          'The webpage could not be retrieved successfully.',
        );
      const mediaType = response.contentType.split(';')[0]?.trim();
      if (mediaType !== 'text/html' && mediaType !== 'text/plain')
        throw new RetrievalError(
          'unsupported_content',
          'The URL did not return a supported text webpage.',
        );
      const charset = /charset\s*=\s*([^;]+)/i
        .exec(response.contentType)?.[1]
        ?.trim()
        .replace(/^['"]|['"]$/g, '')
        .toLowerCase();
      if (charset && charset !== 'utf-8' && charset !== 'us-ascii')
        throw new RetrievalError(
          'unsupported_charset',
          'The webpage uses an unsupported text encoding.',
        );
      const body = response.body.toString('utf8');
      const html = mediaType === 'text/html' ? extractHtml(body) : null;
      const extracted = html ?? extractPlainText(body);
      if (!extracted.text)
        throw new RetrievalError(
          'empty_content',
          'No readable webpage text was found.',
        );
      const extractedAt = new Date().toISOString();
      return {
        status: 'prepared',
        caseId,
        sourceType: 'url',
        submittedAt,
        processingStatus: extracted.partial ? 'partial' : 'extracted',
        extractionMethod:
          mediaType === 'text/html' ? 'html_text' : 'plain_text',
        extractedText: extracted.text,
        metadata: {
          normalizedUrl,
          characterCount: extracted.text.length,
          ...(html?.title ? { pageTitle: html.title } : {}),
        },
        warnings: extracted.partial
          ? [
              'Webpage text exceeded 20,000 characters; the preview contains only the first 20,000.',
            ]
          : [],
        errors: [],
        provenance: {
          sourceType: 'url',
          origin: 'retrieved',
          extractionMethod:
            mediaType === 'text/html' ? 'html_text' : 'plain_text',
          originalUrl,
          finalUrl: current.toString(),
          retrievedAt: extractedAt,
          extractedAt,
          redirectHistory: history,
        },
      };
    }
  } catch (error) {
    if (error instanceof IntakeError) throw error;
    retrievalError =
      error instanceof RetrievalError ? error.code : 'retrieval_unavailable';
  }

  return {
    status: 'prepared',
    caseId,
    sourceType: 'url',
    submittedAt,
    processingStatus: 'unavailable',
    extractionMethod: 'none',
    metadata: { normalizedUrl },
    warnings: [
      'URL recorded only. Its contents have not been retrieved or inspected. No website or employer has been verified.',
    ],
    errors: [retrievalError ?? 'retrieval_unavailable'],
    provenance: {
      sourceType: 'url',
      origin: 'not_extracted',
      extractionMethod: 'none',
      originalUrl,
      redirectHistory: history,
    },
  };
}
