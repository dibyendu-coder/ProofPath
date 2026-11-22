import { describe, expect, it } from 'vitest';
import { processText } from './text.js';

const caseId = '74125c6d-3480-43f0-9fab-e63e93b84b11';
const submittedAt = '2026-11-22T00:00:00.000Z';

describe('submitted text processing', () => {
  it('preserves multiline details, currency, email, URLs, Unicode and Hindi', () => {
    const original =
      'Internship offer\r\nStipend ₹15,000 / month\r\nईमेल hr@example.org\r\nApply: https://example.org/jobs\r\nDate: 22 Nov 2026';
    const result = processText(original, caseId, submittedAt);
    expect(result.extractedText).toBe(
      'Internship offer\nStipend ₹15,000 / month\nईमेल hr@example.org\nApply: https://example.org/jobs\nDate: 22 Nov 2026',
    );
    expect(result.processingStatus).toBe('supplied');
    expect(result.provenance?.origin).toBe('user_supplied');
  });

  it('removes nonprinting characters and excessive whitespace conservatively', () => {
    const result = processText(
      '  Hello\u0000   team\n\n\n\nPlease apply  ',
      caseId,
      submittedAt,
    );
    expect(result.extractedText).toBe('Hello  team\n\n\nPlease apply');
    expect(result.warnings).toHaveLength(1);
  });

  it('rejects empty and oversized text', () => {
    expect(() => processText(' \r\n ', caseId, submittedAt)).toThrow();
    expect(() =>
      processText('x'.repeat(20_001), caseId, submittedAt),
    ).toThrow();
  });
});
