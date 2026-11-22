// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './App';

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/');
});

describe('landing navigation', () => {
  it('opens the mobile menu and closes it after choosing a chapter', async () => {
    const user = userEvent.setup();
    render(<App />);
    const menu = screen.getByRole('button', { name: /menu/i });
    expect(
      screen
        .getByRole('link', { name: /Open the workspace/i })
        .getAttribute('href'),
    ).toBe('/verify');

    expect(menu.getAttribute('aria-expanded')).toBe('false');
    await user.click(menu);
    expect(menu.getAttribute('aria-expanded')).toBe('true');
    await user.click(screen.getByRole('link', { name: 'The signals' }));
    expect(menu.getAttribute('aria-expanded')).toBe('false');
  });

  it('opens the source workspace from the verification route', () => {
    window.history.replaceState({}, '', '/verify');
    render(<App />);

    expect(
      screen.getByRole('heading', {
        name: /Every investigation begins with a source/i,
      }),
    ).toBeTruthy();
    expect(
      screen
        .getByRole('link', { name: /Return to the investigation/i })
        .getAttribute('href'),
    ).toBe('/');
  });
});
