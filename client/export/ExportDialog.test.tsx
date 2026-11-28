// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { report, reviewedText } from '../graph/testFixture';
import { buildVerificationPlan } from '../verification/buildVerificationPlan';
import { initializeVerification } from '../verification/verificationReducer';
import { ExportDialog } from './ExportDialog';

vi.mock('./exportPdf', () => ({
  exportPdf: vi.fn().mockRejectedValue(new Error('PDF font unavailable.')),
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const plan = buildVerificationPlan(report, reviewedText);
const state = initializeVerification(plan, '2026-11-28T00:00:00.000Z');
const result = {
  status: 'prepared' as const,
  caseId: report.caseId,
  sourceType: 'text' as const,
  submittedAt: report.analyzedAt,
  extractedText: reviewedText,
  metadata: { characterCount: reviewedText.length },
  warnings: [],
  extractionMethod: 'user_supplied' as const,
};

describe('export dialog failure recovery', () => {
  it('shows a safe error for mismatched case data, then closes and restores scrolling', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <ExportDialog
        report={report}
        result={{ ...result, caseId: 'different' }}
        reviewedText={reviewedText}
        plan={plan}
        verification={state}
        onClose={onClose}
      />,
    );
    const dialog = screen.getByRole('dialog');
    expect(document.body.style.overflow).toBe('hidden');
    await user.click(
      within(dialog).getByRole('button', { name: 'Generate preview' }),
    );
    expect(screen.getByRole('alert').textContent).toMatch(
      /Could not prepare this report/,
    );
    expect(
      within(dialog).queryByRole('button', { name: 'Download PDF' }),
    ).toBeNull();
    await user.click(
      within(dialog).getByRole('button', { name: 'Cancel export' }),
    );
    expect(onClose).toHaveBeenCalledOnce();
  });
  it('recovers from PDF generation failure while preserving its preview and JSON action', async () => {
    const user = userEvent.setup();
    render(
      <ExportDialog
        report={report}
        result={result}
        reviewedText={reviewedText}
        plan={plan}
        verification={state}
        onClose={() => {}}
      />,
    );
    const dialog = screen.getByRole('dialog');
    await user.click(
      within(dialog).getByRole('button', { name: 'Generate preview' }),
    );
    await within(dialog).findByLabelText('Final report preview');
    await user.click(
      within(dialog).getByRole('button', { name: 'Download PDF' }),
    );
    expect(screen.getByRole('alert').textContent).toMatch(
      /PDF font unavailable/,
    );
    expect(
      within(dialog).getByRole('button', { name: 'Download JSON' }),
    ).toBeTruthy();
  });
  it('rejects excessive redaction phrases before preparing a snapshot', async () => {
    const user = userEvent.setup();
    render(
      <ExportDialog
        report={report}
        result={result}
        reviewedText={reviewedText}
        plan={plan}
        verification={state}
        onClose={() => {}}
      />,
    );
    const dialog = screen.getByRole('dialog');
    await user.type(
      within(dialog).getByRole('textbox', {
        name: /Additional text to redact/,
      }),
      Array.from({ length: 21 }, (_, i) => `term${i}`).join('\n'),
    );
    await user.click(
      within(dialog).getByRole('button', { name: 'Generate preview' }),
    );
    expect(screen.getByRole('alert').textContent).toMatch(
      /at most 20 redaction phrases/,
    );
  });
});
