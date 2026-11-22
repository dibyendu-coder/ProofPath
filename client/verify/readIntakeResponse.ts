import type { IntakeSuccess, SourceType } from '../../shared/contracts';

const sourceTypes: SourceType[] = ['text', 'url', 'image', 'pdf'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPrepared(value: unknown): value is IntakeSuccess {
  return (
    isRecord(value) &&
    value.status === 'prepared' &&
    typeof value.caseId === 'string' &&
    typeof value.submittedAt === 'string' &&
    sourceTypes.includes(value.sourceType as SourceType) &&
    isRecord(value.metadata) &&
    Array.isArray(value.warnings) &&
    value.warnings.every((warning: unknown) => typeof warning === 'string') &&
    (value.extractedText === undefined ||
      typeof value.extractedText === 'string')
  );
}

function failureMessage(value: unknown): string | null {
  if (
    isRecord(value) &&
    value.status === 'failed' &&
    typeof value.code === 'string' &&
    typeof value.message === 'string' &&
    value.message.length > 0
  ) {
    return value.message;
  }
  return null;
}

export async function readIntakeResponse(
  response: Response,
): Promise<IntakeSuccess> {
  const contentType = response.headers
    .get('content-type')
    ?.split(';')[0]
    ?.trim()
    .toLowerCase();
  if (contentType !== 'application/json') {
    throw new Error(
      `The intake service returned an unexpected response (HTTP ${response.status}). Please try again.`,
    );
  }

  let raw: string;
  try {
    raw = await response.text();
  } catch {
    throw new Error(
      'The intake service response could not be read. Please try again.',
    );
  }
  if (!raw.trim()) {
    throw new Error(
      `The intake service returned an empty response (HTTP ${response.status}). Please try again.`,
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error(
      `The intake service returned an unreadable response (HTTP ${response.status}). Please try again.`,
    );
  }

  if (!response.ok) {
    throw new Error(
      failureMessage(payload) ??
        `The intake service could not prepare this source (HTTP ${response.status}). Please try again.`,
    );
  }
  if (isPrepared(payload)) return payload;
  throw new Error(
    'The intake service returned an unexpected result. Please try again.',
  );
}
