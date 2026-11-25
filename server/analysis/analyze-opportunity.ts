import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { analyzeRequest } from './contracts.js';
import { validateEvidence } from './evidence-validator.js';
import { scoreRisk } from './risk-scoring.js';
import { AnalysisError, askGroq, type GroqTransport } from './groq-client.js';

function json(response: ServerResponse, status: number, body: object) {
  if (response.destroyed || response.writableEnded) return;
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(JSON.stringify(body));
}
export function sendAnalysisError(response: ServerResponse, cause: unknown) {
  const error =
    cause instanceof AnalysisError
      ? cause
      : new AnalysisError(
          500,
          'analysis_failed',
          'Analysis failed. Please try again.',
        );
  json(response, error.status, {
    status: 'failed',
    code: error.code,
    message: error.message,
  });
}

export function createAnalyzeHandler(transport?: GroqTransport) {
  let active = 0;
  const visits = new Map<string, number[]>();
  return async (request: IncomingMessage, response: ServerResponse) => {
    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST');
      sendAnalysisError(
        response,
        new AnalysisError(
          405,
          'method_not_allowed',
          'Use POST to analyze a source.',
        ),
      );
      return;
    }
    const client = request.socket.remoteAddress ?? 'unknown';
    const now = Date.now();
    for (const [key, times] of visits)
      if (times.every((time) => now - time > 60_000)) visits.delete(key);
    const times = (visits.get(client) ?? []).filter(
      (time) => now - time < 60_000,
    );
    if (times.length >= 6) {
      response.setHeader('Retry-After', '60');
      sendAnalysisError(
        response,
        new AnalysisError(
          429,
          'rate_limited',
          'Too many analyses. Please wait a minute.',
        ),
      );
      return;
    }
    times.push(now);
    visits.set(client, times);
    if (active >= 2) {
      sendAnalysisError(
        response,
        new AnalysisError(
          503,
          'server_busy',
          'Analysis is busy. Please try again shortly.',
        ),
      );
      return;
    }
    active++;
    const abort = new AbortController();
    const onClose = () => {
      if (!response.writableFinished) abort.abort();
    };
    response.on('close', onClose);
    try {
      if (
        request.headers['content-encoding'] &&
        request.headers['content-encoding'] !== 'identity'
      )
        throw new AnalysisError(
          415,
          'unsupported_encoding',
          'Compressed requests are not supported.',
        );
      if (
        request.headers['content-type']?.split(';')[0]?.toLowerCase() !==
        'application/json'
      )
        throw new AnalysisError(
          415,
          'unsupported_content_type',
          'Send JSON to analyze a source.',
        );
      if (Number(request.headers['content-length'] ?? 0) > 50_000)
        throw new AnalysisError(
          413,
          'request_too_large',
          'Analysis request is too large.',
        );
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const part of request) {
        const chunk = Buffer.isBuffer(part) ? part : Buffer.from(part);
        size += chunk.length;
        if (size > 50_000)
          throw new AnalysisError(
            413,
            'request_too_large',
            'Analysis request is too large.',
          );
        chunks.push(chunk);
      }
      let input: unknown;
      try {
        input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        throw new AnalysisError(
          400,
          'malformed_json',
          'The analysis request is not valid JSON.',
        );
      }
      const parsed = analyzeRequest.safeParse(input);
      if (!parsed.success)
        throw new AnalysisError(
          422,
          'invalid_request',
          'Review and confirm at least 20 characters of source text.',
        );
      const requestData = parsed.data;
      const { model, analysis, metrics } = await askGroq(
        requestData.reviewedText,
        abort.signal,
        transport,
      );
      const evidence = validateEvidence(analysis, requestData);
      const risk = scoreRisk(
        evidence.findings,
        requestData.reviewedText.length,
      );
      const categories = [
        ...new Set(
          evidence.findings.map((finding) =>
            finding.category.replaceAll('_', ' '),
          ),
        ),
      ];
      const summary = categories.length
        ? `The reviewed source contains ${evidence.findings.length} supported warning sign${evidence.findings.length === 1 ? '' : 's'} across ${categories.join(', ')}. These are interpretations of source text, not independently verified facts.`
        : 'No supported warning signs were retained from the reviewed text. This does not establish that the opportunity is safe or legitimate.';
      json(response, 200, {
        status: 'complete',
        analysisId: randomUUID(),
        caseId: requestData.caseId,
        analyzedAt: new Date().toISOString(),
        model,
        providerMetrics: metrics,
        sourceType: requestData.sourceType,
        evidenceOrigin: requestData.extractionMethod,
        userCorrected: requestData.userCorrected,
        provenanceAuthenticated: false,
        opportunityType: analysis.opportunityType,
        summary,
        claims: evidence.claims,
        findings: evidence.findings,
        rejectedEvidenceCount: evidence.rejectedCount,
        missingInformation: analysis.missingInformation,
        uncertaintyIndicators: analysis.uncertaintyIndicators,
        recommendedActions: analysis.recommendedActions,
        limitations: [
          ...analysis.limitations,
          'No employer identity, company registration, or source authenticity was independently verified.',
          ...(requestData.extractionMethod === 'image_ocr'
            ? [
                'OCR may misread currency symbols or digits. User-confirmed transcription is not independently verified; compare it with the original screenshot.',
              ]
            : []),
        ],
        risk,
      });
    } catch (error) {
      sendAnalysisError(response, error);
    } finally {
      active--;
      response.off('close', onClose);
    }
  };
}
