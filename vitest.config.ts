import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'server/**/*.test.ts',
      'client/**/*.test.ts',
      'client/**/*.test.tsx',
    ],
    maxWorkers: 2,
    fileParallelism: false,
  },
});
