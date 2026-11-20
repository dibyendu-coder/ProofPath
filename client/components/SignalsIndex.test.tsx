// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { SignalsIndex } from './SignalsIndex';

afterEach(cleanup);

describe('warning signal index', () => {
  it('reveals a question and supports keyboard selection', async () => {
    const user = userEvent.setup();
    render(<SignalsIndex />);

    const money = screen.getByRole('button', { name: /01 \/ Money/i });
    expect(money.getAttribute('aria-expanded')).toBe('false');
    await user.click(money);
    expect(money.getAttribute('aria-expanded')).toBe('true');
    expect(
      screen.getByText(/confirm the fee using contact details/i),
    ).toBeTruthy();

    const time = screen.getByRole('button', { name: /02 \/ Time/i });
    time.focus();
    await user.keyboard(' ');
    expect(time.getAttribute('aria-expanded')).toBe('true');
    expect(money.getAttribute('aria-expanded')).toBe('false');
  });
});
