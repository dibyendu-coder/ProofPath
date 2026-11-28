// @vitest-environment jsdom
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InvestigationWorkspace } from './InvestigationWorkspace';
import {
  report as graphReport,
  reviewedText as graphText,
} from '../graph/testFixture';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const success = {
  status: 'prepared',
  caseId: '74125c6d-3480-43f0-9fab-e63e93b84b11',
  sourceType: 'text',
  submittedAt: '2026-11-20T00:00:00.000Z',
  extractedText: 'Internship offer',
  metadata: { characterCount: 16 },
  warnings: [],
};

function apiResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

async function submitText(
  user: ReturnType<typeof userEvent.setup>,
  value = 'Offer text',
) {
  await user.type(
    screen.getByRole('textbox', { name: /Opportunity as received/i }),
    value,
  );
  await user.click(screen.getByRole('button', { name: /Prepare source/i }));
}

describe('investigation workspace', () => {
  it('previews and downloads a privacy-redacted JSON report without losing verification state or making another provider call', async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        apiResponse({ ...success, extractedText: graphText }, 201),
      )
      .mockResolvedValueOnce(
        apiResponse({ ...graphReport, caseId: success.caseId }, 200),
      );
    vi.stubGlobal('fetch', fetchMock);
    const create = vi.fn().mockReturnValue('blob:local-report');
    const revoke = vi.fn();
    vi.stubGlobal(
      'URL',
      Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke }),
    );
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});
    render(<InvestigationWorkspace />);
    await submitText(user, graphText);
    await screen.findByRole('heading', { name: /Your source is ready/i });
    await user.click(
      screen.getByRole('button', { name: /Analyze Opportunity/i }),
    );
    await screen.findByRole('heading', { name: /The evidence, in context/i });
    await user.click(screen.getByRole('button', { name: 'Verification plan' }));
    await screen.findByRole('button', { name: 'Start action' });
    await user.click(screen.getByRole('button', { name: 'Start action' }));
    await user.click(screen.getByRole('button', { name: /Export report/i }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Prepare the report.',
    });
    expect(
      within(dialog)
        .getByRole('checkbox', {
          name: 'Private verification notes and responses',
        })
        .getAttribute('checked'),
    ).toBeNull();
    await user.click(
      within(dialog).getByRole('button', { name: 'Generate preview' }),
    );
    await within(dialog).findByLabelText('Final report preview');
    expect(within(dialog).getByText(/44 \/ 100/)).toBeTruthy();
    await user.click(
      within(dialog).getByRole('button', { name: 'Download JSON' }),
    );
    expect(create).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await user.click(
      within(dialog).getByRole('button', { name: 'Cancel export' }),
    );
    expect(
      screen.getByLabelText('Selected verification action').textContent,
    ).toContain('In progress');
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: /Export report/i }),
    );
    click.mockRestore();
  }, 15000);
  it('keeps verification progress across report and graph views and links findings both ways without another API call', async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        apiResponse({ ...success, extractedText: graphText }, 201),
      )
      .mockResolvedValueOnce(
        apiResponse({ ...graphReport, caseId: success.caseId }, 200),
      );
    vi.stubGlobal('fetch', fetchMock);
    render(<InvestigationWorkspace />);
    await submitText(user, graphText);
    await screen.findByRole('heading', { name: /Your source is ready/i });
    await user.click(
      screen.getByRole('button', { name: /Analyze Opportunity/i }),
    );
    await screen.findByRole('heading', { name: /The evidence, in context/i });
    await user.click(screen.getByRole('button', { name: 'Verification plan' }));
    await screen.findByRole('heading', { name: /Make the next check count/i });
    await user.click(screen.getByRole('button', { name: 'Start action' }));
    await user.click(
      screen.getByRole('button', { name: /View finding F-01 in graph/i }),
    );
    const canvas = await screen.findByRole('group', {
      name: 'Pannable graph canvas',
    });
    expect(
      within(canvas)
        .getByRole('button', { name: 'Risk finding: Upfront fee' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    await user.click(
      screen.getByRole('button', { name: 'Open related verification actions' }),
    );
    expect(
      screen.getByLabelText('Selected verification action').textContent,
    ).toContain('In progress');
    await user.click(
      screen.getByRole('button', { name: 'Investigation report' }),
    );
    expect(screen.getByText('44', { selector: 'strong' })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  }, 15000);
  it('switches a real report to the graph, traces exact reviewed source text, and makes no extra provider request', async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        apiResponse({ ...success, extractedText: graphText }, 201),
      )
      .mockResolvedValueOnce(
        apiResponse({ ...graphReport, caseId: success.caseId }, 200),
      );
    vi.stubGlobal('fetch', fetchMock);
    render(<InvestigationWorkspace />);
    await submitText(user, graphText);
    await screen.findByRole('heading', { name: /Your source is ready/i });
    await user.click(
      screen.getByRole('button', { name: /Analyze Opportunity/i }),
    );
    await screen.findByRole('heading', { name: /The evidence, in context/i });
    await user.click(screen.getByRole('button', { name: 'Evidence graph' }));
    await screen.findByRole('heading', { name: 'Follow the evidence.' });
    const canvas = screen.getByRole('group', { name: 'Pannable graph canvas' });
    await user.click(
      within(canvas).getByRole('button', { name: 'Risk finding: Upfront fee' }),
    );
    const transformBeforeTrace = (
      canvas.querySelector('.intelligence-graph__stage') as HTMLElement
    ).style.transform;
    await user.click(screen.getByRole('button', { name: /View in source/i }));
    expect(
      screen.getByText(graphReport.findings[0].quotation, { selector: 'mark' }),
    ).toBeTruthy();
    await user.click(
      screen.getByRole('button', { name: /Return to evidence graph/i }),
    );
    expect(
      within(canvas)
        .getByRole('button', { name: 'Risk finding: Upfront fee' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    expect(
      (canvas.querySelector('.intelligence-graph__stage') as HTMLElement).style
        .transform,
    ).toBe(transformBeforeTrace);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('validates empty text, preserves it across source switches, and resets after success', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(apiResponse(success, 201));
    vi.stubGlobal('fetch', fetchMock);
    render(<InvestigationWorkspace />);
    await user.click(screen.getByRole('button', { name: /Prepare source/i }));
    expect(screen.getByRole('alert').textContent).toMatch(
      /Enter the opportunity text/,
    );
    await user.type(
      screen.getByRole('textbox', { name: /Opportunity as received/i }),
      'Internship offer',
    );
    await user.click(screen.getByRole('button', { name: /Paste URL/i }));
    await user.click(screen.getByRole('button', { name: /Paste text/i }));
    expect(
      (
        screen.getByRole('textbox', {
          name: /Opportunity as received/i,
        }) as HTMLTextAreaElement
      ).value,
    ).toBe('Internship offer');
    await user.click(screen.getByRole('button', { name: /Prepare source/i }));
    await screen.findByRole('heading', { name: /Your source is ready/i });
    expect(screen.getByText(success.caseId)).toBeTruthy();
    expect(screen.getAllByText('Internship offer').length).toBeGreaterThan(0);
    expect(
      screen.getByText(new Date(success.submittedAt).toLocaleString()),
    ).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/intake',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ sourceType: 'text', text: 'Internship offer' }),
      }),
    );
    expect(
      screen.getByText(
        /No organization or claim has been independently verified/,
      ),
    ).toBeTruthy();
    await user.click(
      screen.getByRole('button', { name: /Start another investigation/i }),
    );
    expect(
      (
        screen.getByRole('textbox', {
          name: /Opportunity as received/i,
        }) as HTMLTextAreaElement
      ).value,
    ).toBe('');
  });

  it('rejects malformed and credential URLs before submitting', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<InvestigationWorkspace />);
    await user.click(screen.getByRole('button', { name: /Paste URL/i }));
    const field = screen.getByRole('textbox', { name: /Opportunity link/i });
    await user.type(field, 'not-a-url');
    await user.click(screen.getByRole('button', { name: /Prepare source/i }));
    expect(screen.getByRole('alert').textContent).toMatch(
      /valid HTTP or HTTPS/,
    );
    await user.clear(field);
    await user.type(field, 'https://user:pass@example.com');
    await user.click(screen.getByRole('button', { name: /Prepare source/i }));
    expect(screen.getByRole('alert').textContent).toMatch(
      /username and password/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps the source after a server error', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        apiResponse(
          {
            status: 'failed',
            code: 'server_busy',
            message: 'Please try again shortly.',
          },
          503,
        ),
      ),
    );
    render(<InvestigationWorkspace />);
    await user.type(
      screen.getByRole('textbox', { name: /Opportunity as received/i }),
      'Offer text',
    );
    await user.click(screen.getByRole('button', { name: /Prepare source/i }));
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toMatch(
        /try again shortly/,
      ),
    );
    expect(
      (
        screen.getByRole('textbox', {
          name: /Opportunity as received/i,
        }) as HTMLTextAreaElement
      ).value,
    ).toBe('Offer text');
  });

  it('shows retrieved URL provenance without claiming verification', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        apiResponse(
          {
            ...success,
            sourceType: 'url',
            extractedText: 'Summer internship',
            processingStatus: 'extracted',
            extractionMethod: 'html_text',
            metadata: {
              normalizedUrl: 'https://jobs.example.org/',
              pageTitle: 'Careers',
            },
            provenance: {
              sourceType: 'url',
              origin: 'retrieved',
              extractionMethod: 'html_text',
              originalUrl: 'https://jobs.example.org/',
              finalUrl: 'https://jobs.example.org/',
              retrievedAt: success.submittedAt,
            },
            errors: [],
          },
          201,
        ),
      ),
    );
    render(<InvestigationWorkspace />);
    await user.click(screen.getByRole('button', { name: /Paste URL/i }));
    await user.type(
      screen.getByRole('textbox', { name: /Opportunity link/i }),
      'https://jobs.example.org/',
    );
    await user.click(screen.getByRole('button', { name: /Prepare source/i }));
    await screen.findByText('Readable text extracted');
    expect(screen.getByText('Webpage HTML text')).toBeTruthy();
    expect(screen.getByText('Retrieved webpage text')).toBeTruthy();
    expect(screen.getByText('Careers')).toBeTruthy();
    expect(screen.getAllByText('Summer internship').length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        /Source processing is not an authenticity or safety verification/,
      ),
    ).toBeTruthy();
  });

  it('labels screenshot OCR text as extracted from the image', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        apiResponse(
          {
            ...success,
            sourceType: 'image',
            processingStatus: 'extracted',
            extractionMethod: 'image_ocr',
            extractedText: 'Frontend Engineering Internship',
            metadata: {
              fileName: 'offer.png',
              format: 'png',
              width: 800,
              height: 300,
            },
          },
          201,
        ),
      ),
    );
    render(<InvestigationWorkspace />);
    await user.click(screen.getByRole('button', { name: /Screenshot/i }));
    const file = new File(['image'], 'offer.png', { type: 'image/png' });
    await user.upload(
      document.querySelector('#source-image') as HTMLInputElement,
      file,
    );
    await user.click(screen.getByRole('button', { name: /Prepare source/i }));
    expect((await screen.findAllByText('Screenshot OCR text')).length).toBe(2);
    expect(
      screen.getAllByText('Frontend Engineering Internship').length,
    ).toBeGreaterThan(0);
  });

  it('requires an explicit analysis action, preserves edits on failure, and renders supported report', async () => {
    const user = userEvent.setup();
    const report = {
      status: 'complete',
      analysisId: '28dcbb9e-70b7-41f1-8cd1-c64d3ada3541',
      caseId: success.caseId,
      analyzedAt: '2026-11-25T00:00:00.000Z',
      model: 'openai/gpt-oss-20b',
      sourceType: 'text',
      evidenceOrigin: 'user_corrected',
      provenanceAuthenticated: false,
      opportunityType: 'internship',
      summary: 'The message requests a fee.',
      claims: [],
      findings: [
        {
          id: 'F-01',
          category: 'payment',
          title: 'Upfront payment',
          severity: 'high',
          uncertainty: 'low',
          explanation: 'The source requests money.',
          quotation: 'Pay ₹1,499',
          origin: 'user_corrected',
          start: 0,
          end: 10,
        },
      ],
      rejectedEvidenceCount: 0,
      missingInformation: ['Employer website'],
      uncertaintyIndicators: [],
      recommendedActions: ['Contact employer directly.'],
      limitations: ['No independent verification.'],
      risk: {
        score: 28,
        classification: 'Caution advised',
        explanation: 'Heuristic index.',
      },
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        apiResponse(
          {
            ...success,
            extractedText: 'Pay ₹1,499 within 30 minutes for an internship.',
          },
          201,
        ),
      )
      .mockResolvedValueOnce(
        apiResponse(
          {
            status: 'failed',
            code: 'not_configured',
            message: 'AI analysis is not configured on this server.',
          },
          503,
        ),
      )
      .mockResolvedValueOnce(apiResponse(report, 200));
    vi.stubGlobal('fetch', fetchMock);
    render(<InvestigationWorkspace />);
    await submitText(user, 'Pay ₹1,499 within 30 minutes for an internship.');
    await screen.findByRole('heading', { name: /Your source is ready/i });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const review = screen.getByRole('textbox', {
      name: /Reviewed source text/i,
    });
    await user.clear(review);
    await user.type(
      review,
      'Pay ₹1,499 within 30 minutes for an internship. Contact employer first.',
    );
    await user.click(
      screen.getByRole('button', { name: /Analyze Opportunity/i }),
    );
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'AI analysis is not configured on this server.',
    );
    expect((review as HTMLTextAreaElement).value).toContain(
      'Contact employer first.',
    );
    await user.click(screen.getByRole('button', { name: /Retry analysis/i }));
    expect(
      await screen.findByRole('heading', { name: /The evidence, in context/i }),
    ).toBeTruthy();
    expect(screen.getByText('Caution advised')).toBeTruthy();
    const body = JSON.parse(fetchMock.mock.calls[2][1].body);
    expect(body.userCorrected).toBe(true);
    expect(body.reviewedText).toContain('Contact employer first.');
    expect(body.confirmed).toBe(true);
  });

  it.each([
    [
      'empty body',
      new Response('', {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
      /empty response/i,
    ],
    [
      'malformed JSON',
      new Response('{', {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
      /unreadable response/i,
    ],
    [
      'non-JSON error',
      new Response('<h1>Bad gateway</h1>', {
        status: 502,
        headers: { 'Content-Type': 'text/html' },
      }),
      /unexpected response.*HTTP 502/i,
    ],
    [
      'HTTP 400 validation',
      apiResponse(
        {
          status: 'failed',
          code: 'malformed_json',
          message: 'The request is not valid JSON.',
        },
        400,
      ),
      /not valid JSON/i,
    ],
    [
      'HTTP 413 oversize',
      apiResponse(
        {
          status: 'failed',
          code: 'request_too_large',
          message: 'The submitted source exceeds its size limit.',
        },
        413,
      ),
      /exceeds its size limit/i,
    ],
    [
      'HTTP 500 failure',
      apiResponse(
        {
          status: 'failed',
          code: 'server_error',
          message: 'The source could not be prepared. Please try again.',
        },
        500,
      ),
      /could not be prepared/i,
    ],
  ])('handles %s without losing text', async (_scenario, response, message) => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
    render(<InvestigationWorkspace />);
    await submitText(user);
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toMatch(message),
    );
    expect(
      (
        screen.getByRole('textbox', {
          name: /Opportunity as received/i,
        }) as HTMLTextAreaElement
      ).value,
    ).toBe('Offer text');
    expect(
      screen.queryByRole('heading', { name: /Your source is ready/i }),
    ).toBeNull();
  });
});
