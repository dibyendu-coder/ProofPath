import { resolve } from 'node:path';
import { z } from 'zod';
import { createApp } from './app.js';
import { loadEnvironment } from './load-environment.js';

loadEnvironment();

const port = z.coerce
  .number()
  .int()
  .min(1)
  .max(65535)
  .parse(process.env.PORT ?? 3000);
const clientDirectory = resolve(process.cwd(), 'dist');

createApp(clientDirectory).listen(port, '0.0.0.0', () => {
  console.log(`ProofPath listening on http://localhost:${port}`);
});
