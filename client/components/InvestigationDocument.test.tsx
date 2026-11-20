// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { InvestigationDocument } from './InvestigationDocument';

afterEach(cleanup);

describe('fictional investigation', () => {
  it('reveals contextual notes and counts distinct inspected details', async () => {
    const user = userEvent.setup();
    render(<InvestigationDocument />);

    expect(
      screen
        .getByRole('progressbar', { name: 'Details inspected' })
        .getAttribute('value'),
    ).toBe('0');
    expect(
      screen.getByText(
        'Interactive fictional demonstration — not a live verification.',
      ),
    ).toBeTruthy();

    const payment = screen.getByRole('button', {
      name: /verification payment of ₹999/i,
    });
    await user.click(payment);
    expect(payment.getAttribute('aria-pressed')).toBe('true');
    expect(
      within(screen.getByLabelText('Investigation annotation')).getByText(
        'A payment before the placement',
      ),
    ).toBeTruthy();
    expect(
      screen
        .getByRole('progressbar', { name: 'Details inspected' })
        .getAttribute('value'),
    ).toBe('1');

    await user.click(payment);
    expect(
      screen
        .getByRole('progressbar', { name: 'Details inspected' })
        .getAttribute('value'),
    ).toBe('1');

    const urgency = screen.getByRole('button', {
      name: /expires in 30 minutes/i,
    });
    urgency.focus();
    await user.keyboard('{Enter}');
    expect(urgency.getAttribute('aria-pressed')).toBe('true');
    expect(payment.getAttribute('aria-pressed')).toBe('false');
    expect(
      within(screen.getByLabelText('Investigation annotation')).getByText(
        'A clock that discourages checking',
      ),
    ).toBeTruthy();
    expect(
      screen
        .getByRole('progressbar', { name: 'Details inspected' })
        .getAttribute('value'),
    ).toBe('2');
  });
});
