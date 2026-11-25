import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { loadEnvironment } from './load-environment.js';

const previous = process.env.GROQ_API_KEY;
afterEach(() => {
  if (previous === undefined) delete process.env.GROQ_API_KEY;
  else process.env.GROQ_API_KEY = previous;
});

it('loads an ignored local environment file without overriding deployed credentials', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'proofpath-env-'));
  try {
    await writeFile(join(directory, '.env'), 'GROQ_API_KEY=test-local-value\n');
    delete process.env.GROQ_API_KEY;
    loadEnvironment(directory);
    expect(process.env.GROQ_API_KEY).toBe('test-local-value');
    process.env.GROQ_API_KEY = 'deployed-value';
    loadEnvironment(directory);
    expect(process.env.GROQ_API_KEY).toBe('deployed-value');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
