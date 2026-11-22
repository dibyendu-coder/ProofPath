// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InvestigationWorkspace } from './InvestigationWorkspace';

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
    expect(screen.getByText('Internship offer')).toBeTruthy();
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
      screen.getByText(/AI risk assessment has not yet been performed/),
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
    expect(screen.getByText('Summer internship')).toBeTruthy();
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
    expect(screen.getByText('Frontend Engineering Internship')).toBeTruthy();
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
