// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { EvidenceGraph } from './EvidenceGraph';

afterEach(cleanup);

describe('fictional evidence relationships', () => {
  it('exposes all four nodes and explains suspicious and unverified states', async () => {
    const user = userEvent.setup();
    render(<EvidenceGraph />);

    expect(
      screen.getByText('Fictional demonstration · No live verification'),
    ).toBeTruthy();
    expect(screen.getAllByRole('button')).toHaveLength(4);

    const payment = screen.getByRole('button', {
      name: /Payment request, suspicious signal/i,
    });
    await user.click(payment);
    expect(payment.getAttribute('aria-pressed')).toBe('true');
    expect(
      within(screen.getByRole('status')).getByText('Suspicious signal'),
    ).toBeTruthy();
    expect(
      screen.getByText('Money is requested before confirmation'),
    ).toBeTruthy();

    const recruiter = screen.getByRole('button', {
      name: /Recruiter identity, unverified information/i,
    });
    recruiter.focus();
    await user.keyboard('{Enter}');
    expect(recruiter.getAttribute('aria-pressed')).toBe('true');
    expect(payment.getAttribute('aria-pressed')).toBe('false');
    expect(
      within(screen.getByRole('status')).getByText('Unverified information'),
    ).toBeTruthy();
  });
});
