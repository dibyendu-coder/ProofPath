import { z } from 'zod';

export const MAX_TEXT_CHARS = 20_000;
export const MAX_URL_CHARS = 2_048;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_PDF_BYTES = 10 * 1024 * 1024;
export const MAX_JSON_BYTES = 100_000;

export const textRequest = z
  .object({ sourceType: z.literal('text'), text: z.string() })
  .strict();
export const urlRequest = z
  .object({ sourceType: z.literal('url'), url: z.string() })
  .strict();
export const jsonRequest = z.discriminatedUnion('sourceType', [
  textRequest,
  urlRequest,
]);

export class IntakeError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function validateText(text: string): string {
  if (!text.trim())
    throw new IntakeError(
      422,
      'empty_text',
      'Enter an opportunity message before submitting.',
    );
  if (text.length > MAX_TEXT_CHARS)
    throw new IntakeError(
      413,
      'text_too_long',
      `Text must be ${MAX_TEXT_CHARS.toLocaleString()} characters or fewer.`,
    );
  return text;
}

export function normalizeUrl(input: string): string {
  if (!input.trim())
    throw new IntakeError(422, 'empty_url', 'Enter a URL before submitting.');
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new IntakeError(
      422,
      'invalid_url',
      'Enter a valid HTTP or HTTPS URL.',
    );
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:')
    throw new IntakeError(
      422,
      'invalid_url',
      'Only HTTP and HTTPS URLs are supported.',
    );
  if (url.username || url.password)
    throw new IntakeError(
      422,
      'url_credentials',
      'URLs containing usernames or passwords are not accepted.',
    );
  url.hash = '';
  if (url.toString().length > MAX_URL_CHARS)
    throw new IntakeError(
      413,
      'url_too_long',
      `URLs must be ${MAX_URL_CHARS.toLocaleString()} characters or fewer.`,
    );
  return url.toString();
}

export function safeFileName(
  raw: string | undefined,
  fallback: string,
): string {
  if (!raw) return fallback;
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    throw new IntakeError(
      400,
      'invalid_filename',
      'The file name could not be read.',
    );
  }
  const name = (decoded.split(/[\\/]/).at(-1) ?? '')
    .split('')
    .filter(
      (character) =>
        character.charCodeAt(0) > 31 && character.charCodeAt(0) !== 127,
    )
    .join('')
    .trim();
  return name.slice(0, 160) || fallback;
}
