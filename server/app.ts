import { readFile, stat } from 'node:fs/promises';
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { extname, relative, resolve, sep } from 'node:path';
import type { HealthResponse } from '../shared/contracts.js';

const contentTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

export function createApp(clientDirectory: string) {
  return createServer(
    async (request: IncomingMessage, response: ServerResponse) => {
      const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;

      if (pathname === '/api/health' && request.method === 'GET') {
        const payload: HealthResponse = { status: 'ok' };
        response.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
        });
        response.end(JSON.stringify(payload));
        return;
      }

      if (request.method !== 'GET' && request.method !== 'HEAD') {
        response.writeHead(405, { Allow: 'GET, HEAD' });
        response.end();
        return;
      }

      const isPage =
        pathname === '/' || pathname === '/verify' || pathname === '/verify/';
      if (!isPage && !pathname.startsWith('/assets/')) {
        response.writeHead(404);
        response.end();
        return;
      }

      let decodedPath: string;
      try {
        decodedPath = decodeURIComponent(isPage ? '/index.html' : pathname);
      } catch {
        response.writeHead(400);
        response.end();
        return;
      }

      const filePath = resolve(clientDirectory, `.${decodedPath}`);
      const relativePath = relative(clientDirectory, filePath);
      if (
        relativePath.startsWith(`..${sep}`) ||
        relativePath === '..' ||
        relativePath.startsWith(sep)
      ) {
        response.writeHead(404);
        response.end();
        return;
      }

      try {
        if (!(await stat(filePath)).isFile()) throw new Error('Not a file');
        const body = await readFile(filePath);
        response.writeHead(200, {
          'Content-Type':
            contentTypes[extname(filePath)] ?? 'application/octet-stream',
        });
        response.end(request.method === 'HEAD' ? undefined : body);
      } catch {
        response.writeHead(404);
        response.end();
      }
    },
  );
}
