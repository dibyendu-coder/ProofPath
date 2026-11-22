import { createServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  processUrl,
  requestPinned,
  type UrlDependencies,
} from './url-fetch.js';

const caseId = '74125c6d-3480-43f0-9fab-e63e93b84b11';
const submittedAt = '2026-11-22T00:00:00.000Z';
const publicAddress = { address: '8.8.8.8', family: 4 as const };

function response(
  status: number,
  body = '',
  contentType = 'text/html',
  location?: string,
) {
  return {
    status,
    contentType,
    contentEncoding: '',
    location,
    body: Buffer.from(body),
  };
}

afterEach(() => vi.restoreAllMocks());

describe('controlled URL processing', () => {
  it('retrieves visible HTML text, title and redirect provenance', async () => {
    const resolve = vi.fn(async () => [publicAddress]);
    const request = vi.fn(async (url: URL) =>
      url.pathname === '/old'
        ? response(302, '', 'text/html', '/new')
        : response(
            200,
            '<title>Internships &amp; Careers</title><nav>Menu</nav><main><h1>Summer internship</h1><p>Stipend ₹12,000</p></main><script>secret()</script>',
          ),
    );
    const result = await processUrl(
      'https://jobs.example.org/old',
      caseId,
      submittedAt,
      undefined,
      { resolve, request },
    );
    expect(result.processingStatus).toBe('extracted');
    expect(result.extractedText).toContain('Summer internship');
    expect(result.extractedText).toContain('₹12,000');
    expect(result.extractedText).not.toContain('secret()');
    expect(result.metadata.pageTitle).toBe('Internships & Careers');
    expect(result.provenance).toMatchObject({
      origin: 'retrieved',
      finalUrl: 'https://jobs.example.org/new',
      redirectHistory: ['https://jobs.example.org/old'],
    });
    expect(resolve).toHaveBeenCalledTimes(2);
  });

  it('rejects redirect destinations that lead to localhost', async () => {
    const deps: UrlDependencies = {
      resolve: async () => [publicAddress],
      request: async () =>
        response(302, '', 'text/html', 'http://localhost/private'),
    };
    await expect(
      processUrl(
        'https://jobs.example.org/old',
        caseId,
        submittedAt,
        undefined,
        deps,
      ),
    ).rejects.toMatchObject({ code: 'unsafe_url' });
  });

  it('rejects DNS rebinding even when the first answer was public', async () => {
    let calls = 0;
    const deps: UrlDependencies = {
      resolve: async () =>
        ++calls === 1 ? [publicAddress] : [{ address: '127.0.0.1', family: 4 }],
      request: async () => response(302, '', 'text/html', '/next'),
    };
    await expect(
      processUrl(
        'https://jobs.example.org/start',
        caseId,
        submittedAt,
        undefined,
        deps,
      ),
    ).rejects.toMatchObject({ code: 'unsafe_url' });
  });

  it('stops after the redirect limit', async () => {
    const request = vi.fn(async () => response(302, '', 'text/html', '/next'));
    const deps: UrlDependencies = {
      resolve: async () => [publicAddress],
      request,
    };
    const result = await processUrl(
      'https://jobs.example.org/start',
      caseId,
      submittedAt,
      undefined,
      deps,
    );
    expect(result.processingStatus).toBe('unavailable');
    expect(result.errors).toContain('redirect_limit');
    expect(request).toHaveBeenCalledTimes(4);
  });

  it.each([
    [
      'unsupported content',
      response(200, 'binary', 'application/pdf'),
      'unsupported_content',
    ],
    ['remote failure', response(503), 'remote_status'],
    [
      'missing text',
      response(200, '<html><body><nav>Menu</nav></body></html>'),
      'empty_content',
    ],
  ])(
    'returns an honest unavailable receipt for %s',
    async (_name, page, code) => {
      const deps: UrlDependencies = {
        resolve: async () => [publicAddress],
        request: async () => page,
      };
      const result = await processUrl(
        'https://jobs.example.org/',
        caseId,
        submittedAt,
        undefined,
        deps,
      );
      expect(result.processingStatus).toBe('unavailable');
      expect(result.errors).toContain(code);
      expect(result.extractedText).toBeUndefined();
      expect(result.provenance?.origin).toBe('not_extracted');
    },
  );

  it('marks extracted text over 20,000 characters as partial', async () => {
    const deps: UrlDependencies = {
      resolve: async () => [publicAddress],
      request: async () => response(200, 'a'.repeat(20_001), 'text/plain'),
    };
    const result = await processUrl(
      'https://jobs.example.org/',
      caseId,
      submittedAt,
      undefined,
      deps,
    );
    expect(result.processingStatus).toBe('partial');
    expect(result.extractedText).toHaveLength(20_000);
    expect(result.warnings).toHaveLength(1);
  });
});

describe('pinned HTTP transport', () => {
  it('connects to the supplied address while keeping the original Host header', async () => {
    const server = createServer((request, response) => {
      expect(request.headers.host).toMatch(/^jobs\.example\.org:/);
      response.writeHead(200, { 'Content-Type': 'text/html' });
      response.end('<h1>Offer</h1>');
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('No port');
      const result = await requestPinned(
        new URL(`http://jobs.example.org:${address.port}/`),
        { address: '127.0.0.1', family: 4 },
        Date.now() + 2_000,
      );
      expect(result.body.toString()).toContain('Offer');
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('bounds oversized and slow responses', async () => {
    const server = createServer((_request, response) => {
      response.writeHead(200, { 'Content-Type': 'text/html' });
      response.end(Buffer.alloc(1_000_001, 65));
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('No port');
      await expect(
        requestPinned(
          new URL(`http://jobs.example.org:${address.port}/`),
          { address: '127.0.0.1', family: 4 },
          Date.now() + 2_000,
        ),
      ).rejects.toThrow(/too large/i);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('rejects a compressed response that expands beyond the decoded limit', async () => {
    const server = createServer((_request, response) => {
      response.writeHead(200, {
        'Content-Type': 'text/html',
        'Content-Encoding': 'gzip',
      });
      response.end(gzipSync(Buffer.alloc(2_000_001, 65)));
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('No port');
      await expect(
        requestPinned(
          new URL(`http://jobs.example.org:${address.port}/`),
          { address: '127.0.0.1', family: 4 },
          Date.now() + 2_000,
        ),
      ).rejects.toThrow(/too large/i);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('times out a server that does not respond', async () => {
    const server = createServer(() => {
      /* Intentionally never responds. */
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('No port');
      await expect(
        requestPinned(
          new URL(`http://jobs.example.org:${address.port}/`),
          { address: '127.0.0.1', family: 4 },
          Date.now() + 40,
        ),
      ).rejects.toThrow(/timed out/i);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

describe('pinned HTTPS transport', () => {
  it('keeps SNI and hostname verification when the IP is pinned', async () => {
    const key = await readFile(
      new URL('./fixtures/jobs-test-key.pem', import.meta.url),
    );
    const cert = await readFile(
      new URL('./fixtures/jobs-test-cert.pem', import.meta.url),
    );
    let observedServerName = '';
    const server = createHttpsServer({ key, cert }, (request, response) => {
      observedServerName = request.socket.servername;
      response.writeHead(200, { 'Content-Type': 'text/html' });
      response.end('<h1>Opportunity</h1>');
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('No port');
      const pinned = { address: '127.0.0.1', family: 4 as const };
      const valid = await requestPinned(
        new URL(`https://jobs.example.org:${address.port}/`),
        pinned,
        Date.now() + 3_000,
        undefined,
        { ca: cert },
      );
      expect(valid.body.toString()).toContain('Opportunity');
      expect(observedServerName).toBe('jobs.example.org');
      await expect(
        requestPinned(
          new URL(`https://other.example.org:${address.port}/`),
          pinned,
          Date.now() + 3_000,
          undefined,
          { ca: cert },
        ),
      ).rejects.toMatchObject({ code: 'ERR_TLS_CERT_ALTNAME_INVALID' });
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
