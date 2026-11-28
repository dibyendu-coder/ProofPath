// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { report, reviewedText } from '../graph/testFixture';
import { buildVerificationPlan } from './buildVerificationPlan';
import { VerificationWorkspace } from './VerificationWorkspace';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const plan = buildVerificationPlan(report, reviewedText);

describe('verification workspace', () => {
  it.each([
    {
      name: 'ordinary detailed internship',
      analysisId: 'ordinary-case',
      missingInformation: ['Employer identity'],
      expected: 'Check the organization identity',
    },
    {
      name: 'ambiguous sparse opportunity',
      analysisId: 'ambiguous-case',
      missingInformation: ['Selection process'],
      expected: 'Clarify role and selection details',
    },
  ])(
    'supports the $name workflow without inventing findings',
    async ({ analysisId, missingInformation, expected }) => {
      const user = userEvent.setup();
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText },
      });
      const planForCase = buildVerificationPlan(
        {
          ...report,
          analysisId,
          findings: [],
          claims: [],
          missingInformation,
          recommendedActions: [],
          risk: {
            score: 0,
            classification: 'Inconclusive',
            explanation: 'Insufficient information.',
          },
        },
        reviewedText,
      );
      const onViewFinding = vi.fn();
      render(
        <VerificationWorkspace
          plan={planForCase}
          active
          focusFindingId={null}
          focusRequest={0}
          onViewFinding={onViewFinding}
        />,
      );
      expect(
        screen.getByLabelText('Selected verification action').textContent,
      ).toContain(expected);
      expect(screen.queryByText('Supported findings')).toBeNull();
      await user.click(
        screen.getAllByRole('button', { name: 'Copy question' })[0],
      );
      expect(writeText).toHaveBeenCalledTimes(1);
      const draft = screen.getByLabelText('Editable message');
      await user.clear(draft);
      await user.type(
        draft,
        'Could you confirm the role through an official channel?',
      );
      await user.click(
        screen.getByRole('button', { name: 'Copy edited draft' }),
      );
      await user.click(screen.getByRole('button', { name: 'Start action' }));
      await user.selectOptions(screen.getByLabelText('Entry type'), 'response');
      await user.type(
        screen.getByLabelText('Text'),
        'A fictional response was received.',
      );
      await user.click(screen.getByRole('button', { name: 'Record entry' }));
      await user.click(screen.getByRole('button', { name: 'Mark complete' }));
      await user.click(screen.getByRole('button', { name: 'Reopen action' }));
      expect(
        screen.getByText('A fictional response was received.'),
      ).toBeTruthy();
      expect(
        screen.getByText(/Verification plan initialized in this browser/),
      ).toBeTruthy();
      expect(screen.getByText(new RegExp(`Reopened ${expected}`))).toBeTruthy();
      expect(onViewFinding).not.toHaveBeenCalled();
      expect(
        planForCase.actions.every((action) => action.findingIds.length === 0),
      ).toBe(true);
    },
  );
  it('records response, completes and reopens action, and shows real local timeline', async () => {
    const user = userEvent.setup();
    render(
      <VerificationWorkspace
        plan={plan}
        active
        focusFindingId={null}
        focusRequest={0}
        onViewFinding={() => {}}
      />,
    );
    expect(
      screen.getByText(/Checklist completion measures your activity only/),
    ).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Start action' }));
    await user.selectOptions(screen.getByLabelText('Entry type'), 'response');
    await user.type(
      screen.getByLabelText('Text'),
      'The sender replied with a policy claim.',
    );
    await user.type(
      screen.getByLabelText(/Reference URL/),
      'https://example.org/policy',
    );
    await user.click(screen.getByRole('button', { name: 'Record entry' }));
    expect(
      screen.getByText('The sender replied with a policy claim.'),
    ).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Mark complete' }));
    expect(screen.getAllByText(/User marked complete/).length).toBeGreaterThan(
      0,
    );
    await user.click(screen.getByRole('button', { name: 'Reopen action' }));
    expect(
      screen.getByText(/Reopened Clarify the payment policy/),
    ).toBeTruthy();
    expect(screen.getByText(/ProofPath has not contacted anyone/)).toBeTruthy();
  });
  it('copies a contextual question, edits a neutral draft, and navigates to a finding', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const onViewFinding = vi.fn();
    render(
      <VerificationWorkspace
        plan={plan}
        active
        focusFindingId={null}
        focusRequest={0}
        onViewFinding={onViewFinding}
      />,
    );
    const detail = screen.getByLabelText('Selected verification action');
    await user.click(
      within(detail).getAllByRole('button', { name: 'Copy question' })[0],
    );
    expect(writeText).toHaveBeenCalledWith(
      expect.stringMatching(/payment required/),
    );
    const draft = screen.getByLabelText('Editable message');
    await user.clear(draft);
    await user.type(
      draft,
      'Please confirm the role through your published contact.',
    );
    await user.click(screen.getByRole('button', { name: 'Copy edited draft' }));
    expect(writeText).toHaveBeenLastCalledWith(
      'Please confirm the role through your published contact.',
    );
    await user.click(
      screen.getByRole('button', { name: /View finding F-01 in graph/ }),
    );
    expect(onViewFinding).toHaveBeenCalledWith('F-01');
  });
  it('renders untrusted report text as inert text and rejects unsafe reference URLs', async () => {
    const user = userEvent.setup();
    const unsafe = buildVerificationPlan(
      {
        ...report,
        findings: [],
        missingInformation: ['<img src=x onerror=alert(1)>'],
        recommendedActions: [],
      },
      reviewedText,
    );
    render(
      <VerificationWorkspace
        plan={unsafe}
        active
        focusFindingId={null}
        focusRequest={0}
        onViewFinding={() => {}}
      />,
    );
    expect(screen.getByText(/<img src=x onerror=alert/)).toBeTruthy();
    expect(document.querySelector('img')).toBeNull();
    await user.type(screen.getByLabelText('Text'), 'A note');
    await user.type(
      screen.getByLabelText(/Reference URL/),
      'javascript:alert(1)',
    );
    await user.click(screen.getByRole('button', { name: 'Record entry' }));
    expect(screen.getByRole('status').textContent).toMatch(
      /valid HTTP or HTTPS/,
    );
  });
  it('focuses the matching action after graph navigation without replacing recorded progress', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <VerificationWorkspace
        plan={plan}
        active
        focusFindingId={null}
        focusRequest={0}
        onViewFinding={() => {}}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Start action' }));
    rerender(
      <VerificationWorkspace
        plan={plan}
        active
        focusFindingId="F-02"
        focusRequest={1}
        onViewFinding={() => {}}
      />,
    );
    expect(
      screen.getByLabelText('Selected verification action').textContent,
    ).toContain('Make time for independent checks');
    rerender(
      <VerificationWorkspace
        plan={plan}
        active
        focusFindingId={null}
        focusRequest={1}
        onViewFinding={() => {}}
      />,
    );
    await user.click(
      screen.getByRole('button', { name: /Clarify the payment policy/ }),
    );
    expect(
      screen.getByLabelText('Selected verification action').textContent,
    ).toContain('In progress');
  });
});
