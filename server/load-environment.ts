import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';

/** Local development convenience; deployed environment variables take precedence. */
export function loadEnvironment(directory = process.cwd()) {
  const path = resolve(directory, '.env');
  if (existsSync(path)) loadEnvFile(path);
}
