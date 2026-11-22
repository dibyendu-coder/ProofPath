import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { ImageMetadata } from './image-metadata.js';
import { IntakeError } from './intake-validation.js';

type WorkerResult =
  | {
      ok: true;
      text: string;
      width: number;
      height: number;
      peakRssBytes: number;
    }
  | { ok: false; code: string; message: string };

export function extractImageText(
  bytes: Buffer,
  expected: ImageMetadata,
  signal?: AbortSignal,
  options: { workerUrl?: URL; timeoutMs?: number } = {},
): Promise<{
  text: string;
  width: number;
  height: number;
  peakRssBytes: number;
}> {
  const workerUrl =
    options.workerUrl ??
    (import.meta.url.endsWith('.ts')
      ? new URL('../dist-server/server/ocr-worker.js', import.meta.url)
      : new URL('./ocr-worker.js', import.meta.url));
  const child = fork(fileURLToPath(workerUrl), [], {
    execArgv: ['--max-old-space-size=128'],
    serialization: 'advanced',
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    windowsHide: true,
  });

  return new Promise((resolve, reject) => {
    let finished = false;
    const finish = (
      error?: Error,
      result?: {
        text: string;
        width: number;
        height: number;
        peakRssBytes: number;
      },
    ) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      child.kill();
      if (error) reject(error);
      else if (result) resolve(result);
    };
    const onAbort = () =>
      finish(new IntakeError(499, 'cancelled', 'Submission cancelled.'));
    const timer = setTimeout(
      () =>
        finish(
          new IntakeError(
            422,
            'ocr_timeout',
            'This screenshot took too long to process. Try a clearer image.',
          ),
        ),
      options.timeoutMs ?? 15_000,
    );
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) {
      onAbort();
      return;
    }
    child.on('message', (message: WorkerResult) => {
      if (message.ok)
        finish(undefined, {
          text: message.text,
          width: message.width,
          height: message.height,
          peakRssBytes: message.peakRssBytes,
        });
      else finish(new IntakeError(422, message.code, message.message));
    });
    child.on('error', () =>
      finish(
        new IntakeError(
          500,
          'ocr_processing_failed',
          'Screenshot text extraction could not be completed.',
        ),
      ),
    );
    child.on('exit', () => {
      if (!finished)
        finish(
          new IntakeError(
            500,
            'ocr_processing_failed',
            'Screenshot text extraction could not be completed.',
          ),
        );
    });
    child.send({ bytes, expected }, (error) => {
      if (error)
        finish(
          new IntakeError(
            500,
            'ocr_processing_failed',
            'Screenshot text extraction could not be completed.',
          ),
        );
    });
  });
}
