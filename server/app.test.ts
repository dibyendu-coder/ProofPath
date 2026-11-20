import { afterEach, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from './app.js';

let server: Server | undefined;

afterEach(async () => {
  if (server)
    await new Promise<void>((resolve) => server!.close(() => resolve()));
  server = undefined;
});

describe('HTTP foundation', () => {
  it('serves a health response and rejects unknown API routes', async () => {
    server = createApp('dist');
    await new Promise<void>((resolve) =>
      server!.listen(0, '127.0.0.1', resolve),
    );
    const address = server.address();
    if (!address || typeof address === 'string')
      throw new Error('No TCP address');
    const base = `http://127.0.0.1:${address.port}`;

    const health = await fetch(`${base}/api/health`);
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: 'ok' });

    const unknown = await fetch(`${base}/api/analysis`);
    expect(unknown.status).toBe(404);
  });

  it('serves the honest verification placeholder route', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'proofpath-'));
    try {
      await writeFile(
        join(directory, 'index.html'),
        '<title>ProofPath</title>',
      );
      server = createApp(directory);
      await new Promise<void>((resolve) =>
        server!.listen(0, '127.0.0.1', resolve),
      );
      const address = server.address();
      if (!address || typeof address === 'string')
        throw new Error('No TCP address');

      const response = await fetch(`http://127.0.0.1:${address.port}/verify`);
      expect(response.status).toBe(200);
      expect(await response.text()).toContain('<title>ProofPath</title>');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
