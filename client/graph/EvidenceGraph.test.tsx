// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EvidenceGraph } from './EvidenceGraph';
import { report, reviewedText } from './testFixture';

afterEach(cleanup);

describe('evidence graph interaction', () => {
  it('selects a finding, inspects exact evidence, focuses, clears, and traces source offsets', async () => {
    const user = userEvent.setup();
    const onTrace = vi.fn();
    render(
      <EvidenceGraph
        report={report}
        reviewedText={reviewedText}
        onTrace={onTrace}
        active
      />,
    );
    const canvas = screen.getByRole('group', { name: 'Pannable graph canvas' });
    const node = within(canvas).getByRole('button', {
      name: 'Risk finding: Upfront fee',
    });
    await user.click(node);
    expect(node.getAttribute('aria-pressed')).toBe('true');
    const inspector = screen.getByRole('complementary', {
      name: 'Evidence inspector',
    });
    expect(
      within(inspector).getByText('The source requests payment.'),
    ).toBeTruthy();
    expect(
      within(inspector).getByText(/Pay ₹1,499 within 30 minutes/),
    ).toBeTruthy();
    await user.click(
      within(inspector).getByRole('button', { name: 'Focus on finding' }),
    );
    expect(node.getAttribute('aria-pressed')).toBe('true');
    await user.click(
      within(inspector).getByRole('button', { name: /View in source/ }),
    );
    expect(onTrace).toHaveBeenCalledWith(
      report.findings[0].start,
      report.findings[0].end,
    );
    await user.click(
      within(inspector).getByRole('button', { name: 'Clear selection' }),
    );
    expect(node.getAttribute('aria-pressed')).toBe('false');
  });
  it('filters, resets, zooms, and offers a text alternative', async () => {
    const user = userEvent.setup();
    render(
      <EvidenceGraph
        report={report}
        reviewedText={reviewedText}
        onTrace={() => {}}
        active
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Risk findings' }));
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Filter severity' }),
      'high',
    );
    const canvas = screen.getByRole('group', { name: 'Pannable graph canvas' });
    expect(
      within(canvas).getByRole('button', { name: 'Risk finding: Upfront fee' }),
    ).toBeTruthy();
    expect(
      within(canvas).queryByRole('button', {
        name: 'Risk finding: Short deadline',
      }),
    ).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Reset filters' }));
    expect(
      within(canvas).getByRole('button', {
        name: 'Risk finding: Short deadline',
      }),
    ).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Zoom in' }));
    await user.click(screen.getByRole('button', { name: 'Zoom out' }));
    await user.click(screen.getByRole('button', { name: 'Fit to view' }));
    await user.click(screen.getByRole('button', { name: 'Reset view' }));
    await user.click(screen.getByText(/Accessible evidence list/));
    expect(
      screen.getAllByRole('button', {
        name: /Source evidence: Source quotation/,
      }).length,
    ).toBeGreaterThan(0);
  });
  it('pans from empty stage space and keeps the graph transform when selected', async () => {
    const user = userEvent.setup();
    render(
      <EvidenceGraph
        report={report}
        reviewedText={reviewedText}
        onTrace={() => {}}
        active
      />,
    );
    const canvas = screen.getByRole('group', { name: 'Pannable graph canvas' });
    const stage = canvas.querySelector(
      '.intelligence-graph__stage',
    ) as HTMLElement;
    Object.defineProperty(canvas, 'setPointerCapture', { value: vi.fn() });
    const before = stage.style.transform;
    fireEvent.pointerDown(stage, { pointerId: 1, clientX: 20, clientY: 20 });
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 70, clientY: 90 });
    fireEvent.pointerUp(canvas, { pointerId: 1 });
    expect(stage.style.transform).not.toBe(before);
    await user.click(
      within(canvas).getByRole('button', { name: 'Risk finding: Upfront fee' }),
    );
    expect(stage.style.transform).not.toBe(before);
  });
  it('provides an informative empty finding filter for inconclusive analysis', async () => {
    const user = userEvent.setup();
    render(
      <EvidenceGraph
        report={{ ...report, findings: [], claims: [] }}
        reviewedText={reviewedText}
        onTrace={() => {}}
        active
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Risk findings' }));
    expect(screen.getByText('No matching evidence')).toBeTruthy();
    expect(screen.getByText(/not a safety verdict/)).toBeTruthy();
  });
});
