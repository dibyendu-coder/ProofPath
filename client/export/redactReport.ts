import type { ExportOptions } from './types';

const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE = /(?<![\w])(?:\+?\d[\d\s().-]{8,}\d)(?![\w])/g;
const URL = /\bhttps?:\/\/[^\s<>"']+/gi;
const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function redactText(value: string, options: ExportOptions) {
  let text = value;
  if (!options.includeSourceUrls) text = text.replace(URL, '[REDACTED URL]');
  if (!options.includeContacts) {
    text = text.replace(EMAIL, '[REDACTED EMAIL]');
    text = text.replace(PHONE, '[REDACTED PHONE]');
  }
  for (const term of options.redactTerms) {
    const clean = term.trim();
    if (clean)
      text = text.replace(new RegExp(escapeRegExp(clean), 'gi'), '[REDACTED]');
  }
  return { text, redacted: text !== value };
}
