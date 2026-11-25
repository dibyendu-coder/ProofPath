import { modelAnalysis, groqSchema, type ModelAnalysis } from './contracts.js';
import { systemPrompt } from './system-prompt.js';

export class AnalysisError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export type GroqTransport = typeof fetch;
export type ProviderMetrics = {
  latencyMs: number;
  requests: number;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } | null;
};
const endpoint = 'https://api.groq.com/openai/v1/chat/completions';
const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, ms);
    const abort = () => {
      clearTimeout(timer);
      reject(
        new AnalysisError(
          504,
          'timeout',
          'Analysis timed out. Please try again.',
        ),
      );
    };
    signal.addEventListener('abort', abort, { once: true });
  });

export async function askGroq(
  text: string,
  signal: AbortSignal,
  transport: GroqTransport = fetch,
): Promise<{
  model: string;
  analysis: ModelAnalysis;
  metrics: ProviderMetrics;
}> {
  const key = process.env.GROQ_API_KEY?.trim();
  if (!key)
    throw new AnalysisError(
      503,
      'not_configured',
      'AI analysis is not configured on this server.',
    );
  const model = process.env.GROQ_MODEL?.trim() || 'openai/gpt-oss-120b';
  const started = performance.now();
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(18_000)]);
  for (let attempt = 0; attempt < 2; attempt++) {
    let response: Response;
    try {
      response = await transport(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: `Review only this source text:\n<source>\n${text}\n</source>`,
            },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'proofpath_analysis',
              strict: true,
              schema: groqSchema,
            },
          },
          temperature: 0.2,
          max_completion_tokens: 2500,
        }),
        signal: deadline,
      });
    } catch {
      if (deadline.aborted)
        throw new AnalysisError(
          504,
          'timeout',
          'Analysis timed out. Please try again.',
        );
      if (attempt === 0) {
        await wait(350, deadline);
        continue;
      }
      throw new AnalysisError(
        502,
        'network_failure',
        'The AI provider could not be reached. Please try again.',
      );
    }
    if (!response.ok) {
      let providerCode = '';
      if (response.status === 400) {
        try {
          const body: unknown = await response.json();
          if (body && typeof body === 'object' && 'error' in body) {
            const error = body.error;
            if (
              error &&
              typeof error === 'object' &&
              'code' in error &&
              typeof error.code === 'string'
            )
              providerCode = error.code;
          }
        } catch {
          /* An unreadable provider error is still a safe API failure. */
        }
        if (providerCode === 'json_validate_failed') {
          if (attempt === 0) {
            await wait(350, deadline);
            continue;
          }
          throw new AnalysisError(
            502,
            'invalid_model_output',
            'The AI provider could not produce a valid structured analysis. Please try again.',
          );
        }
      }
      if (
        [429, 500, 502, 503, 504].includes(response.status) &&
        attempt === 0
      ) {
        await wait(response.status === 429 ? 800 : 350, deadline);
        continue;
      }
      if (response.status === 401 || response.status === 403)
        throw new AnalysisError(
          503,
          'authentication_failed',
          'AI analysis is not available with the current server credentials.',
        );
      if (
        response.status === 404 ||
        (response.status === 400 && /model|unsupported/i.test(providerCode))
      )
        throw new AnalysisError(
          503,
          'model_unavailable',
          'The configured AI model is unavailable or incompatible.',
        );
      if (response.status === 400)
        throw new AnalysisError(
          502,
          'provider_request_invalid',
          'The AI provider rejected the analysis request.',
        );
      if (response.status === 429)
        throw new AnalysisError(
          429,
          'provider_rate_limited',
          'The AI provider is busy. Please try again later.',
        );
      throw new AnalysisError(
        502,
        'provider_failure',
        'The AI provider could not complete the analysis.',
      );
    }
    let raw: string;
    try {
      raw = await response.text();
    } catch {
      throw new AnalysisError(
        502,
        'invalid_model_output',
        'The AI provider returned an unreadable response.',
      );
    }
    if (raw.length > 150_000)
      throw new AnalysisError(
        502,
        'invalid_model_output',
        'The AI provider returned an oversized response.',
      );
    try {
      const envelope: unknown = JSON.parse(raw);
      if (!envelope || typeof envelope !== 'object' || !('choices' in envelope))
        throw new Error('envelope');
      const content = (
        envelope as { choices?: { message?: { content?: unknown } }[] }
      ).choices?.[0]?.message?.content;
      if (typeof content !== 'string') throw new Error('content');
      const parsed = modelAnalysis.safeParse(JSON.parse(content));
      if (!parsed.success) throw new Error('schema');
      const usage = (envelope as { usage?: Record<string, unknown> }).usage;
      const validUsage =
        usage &&
        Number.isInteger(usage.prompt_tokens) &&
        Number.isInteger(usage.completion_tokens) &&
        Number.isInteger(usage.total_tokens)
          ? {
              promptTokens: usage.prompt_tokens as number,
              completionTokens: usage.completion_tokens as number,
              totalTokens: usage.total_tokens as number,
            }
          : null;
      return {
        model,
        analysis: parsed.data,
        metrics: {
          latencyMs: Math.round(performance.now() - started),
          requests: attempt + 1,
          usage: validUsage,
        },
      };
    } catch {
      throw new AnalysisError(
        502,
        'invalid_model_output',
        'The AI provider returned an invalid analysis. Please try again.',
      );
    }
  }
  throw new AnalysisError(
    502,
    'provider_failure',
    'The AI provider could not complete the analysis.',
  );
}
