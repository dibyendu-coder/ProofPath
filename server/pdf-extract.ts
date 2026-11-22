import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { IntakeError } from './intake-validation.js';

type WorkerResult =
  | {
      ok: true;
      text: string;
      pageCount: number;
      pageNumbers: number[];
      blankPages: number[];
    }
  | { ok: false; code: string; message: string };

export function extractPdf(
  bytes: Buffer,
  signal?: AbortSignal,
  options: { workerUrl?: URL; timeoutMs?: number } = {},
): Promise<{
  text: string;
  pageCount: number;
  pageNumbers: number[];
  blankPages: number[];
}> {
  const workerUrl =
    options.workerUrl ??
    (import.meta.url.endsWith('.ts')
      ? new URL('../dist-server/server/pdf-worker.js', import.meta.url)
      : new URL('./pdf-worker.js', import.meta.url));
  const child = fork(fileURLToPath(workerUrl), [], {
    execArgv: ['--max-old-space-size=160'],
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
        pageCount: number;
        pageNumbers: number[];
        blankPages: number[];
      },
      terminate = false,
    ) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      if (terminate) child.kill();
      if (error) reject(error);
      else if (result) resolve(result);
    };
    const onAbort = () =>
      finish(
        new IntakeError(499, 'cancelled', 'Submission cancelled.'),
        undefined,
        true,
      );
    const timer = setTimeout(
      () =>
        finish(
          new IntakeError(
            422,
            'pdf_timeout',
            'This PDF took too long to process. Try a simpler document.',
          ),
          undefined,
          true,
        ),
      options.timeoutMs ?? 12_000,
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
          pageCount: message.pageCount,
          pageNumbers: message.pageNumbers,
          blankPages: message.blankPages,
        });
      else finish(new IntakeError(422, message.code, message.message));
    });
    child.on('error', () =>
      finish(
        new IntakeError(
          422,
          'pdf_processing_failed',
          'This PDF could not be processed.',
        ),
        undefined,
        true,
      ),
    );
    child.on('exit', () => {
      if (!finished)
        finish(
          new IntakeError(
            422,
            'pdf_processing_failed',
            'This PDF could not be processed.',
          ),
        );
    });
    child.send(bytes, (error) => {
      if (error)
        finish(
          new IntakeError(
            422,
            'pdf_processing_failed',
            'This PDF could not be processed.',
          ),
          undefined,
          true,
        );
    });
  });
}
