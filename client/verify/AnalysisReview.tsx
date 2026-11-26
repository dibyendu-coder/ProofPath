import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { AnalysisReport, IntakeSuccess } from '../../shared/contracts';
import { sourceSpan } from '../graph/buildEvidenceGraph';
import { buildVerificationPlan } from '../verification/buildVerificationPlan';

const EvidenceGraph = lazy(() =>
  import('../graph/EvidenceGraph').then((module) => ({
    default: module.EvidenceGraph,
  })),
);
const VerificationWorkspace = lazy(() =>
  import('../verification/VerificationWorkspace').then((module) => ({
    default: module.VerificationWorkspace,
  })),
);

function readReport(value: unknown): value is AnalysisReport {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    value.status === 'complete' &&
    'findings' in value &&
    Array.isArray(value.findings) &&
    'risk' in value &&
    'caseId' in value
  );
}

async function requestReport(
  result: IntakeSuccess,
  reviewedText: string,
  original: string,
  signal: AbortSignal,
): Promise<AnalysisReport> {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      caseId: result.caseId,
      sourceType: result.sourceType,
      extractionMethod: result.extractionMethod ?? 'none',
      reviewedText,
      userCorrected: reviewedText !== original,
      confirmed: true,
    }),
    signal,
  });
  if (
    !response.headers
      .get('content-type')
      ?.toLowerCase()
      .startsWith('application/json')
  )
    throw new Error(
      `Analysis service returned an unexpected response (HTTP ${response.status}).`,
    );
  const raw = await response.text();
  if (!raw.trim())
    throw new Error('Analysis service returned an empty response.');
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error('Analysis service returned an unreadable response.');
  }
  if (!response.ok) {
    if (
      typeof payload === 'object' &&
      payload !== null &&
      'message' in payload &&
      typeof payload.message === 'string'
    )
      throw new Error(payload.message);
    throw new Error(
      `Analysis failed (HTTP ${response.status}). Please try again.`,
    );
  }
  if (!readReport(payload) || payload.caseId !== result.caseId)
    throw new Error('Analysis service returned an invalid report.');
  return payload;
}

function Report({ report, text }: { report: AnalysisReport; text: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<'report' | 'graph' | 'verification'>(
    'report',
  );
  const plan = useMemo(
    () => buildVerificationPlan(report, text),
    [report, text],
  );
  const [verificationFocus, setVerificationFocus] = useState<{
    findingId: string | null;
    actionId?: string;
    request: number;
  }>({ findingId: null, request: 0 });
  const [graphFocus, setGraphFocus] = useState<{
    findingId: string | null;
    request: number;
  }>({ findingId: null, request: 0 });
  const [sourceHighlight, setSourceHighlight] = useState<{
    start: number;
    end: number;
  } | null>(null);
  const sourceRef = useRef<HTMLDivElement>(null);
  const selectedFinding = report.findings.find(
    (finding) => finding.id === selected,
  );
  const span =
    sourceHighlight ??
    (selectedFinding
      ? { start: selectedFinding.start, end: selectedFinding.end }
      : null);
  const expectedQuote = sourceHighlight
    ? text.slice(sourceHighlight.start, sourceHighlight.end)
    : selectedFinding?.quotation;
  const validSpan =
    span &&
    expectedQuote &&
    sourceSpan(text, expectedQuote, span.start, span.end)
      ? span
      : null;
  useEffect(() => {
    if (view === 'report' && sourceHighlight)
      sourceRef.current?.scrollIntoView?.({ block: 'center' });
  }, [view, sourceHighlight]);
  return (
    <article className="analysis-report" aria-labelledby="report-heading">
      <div className="analysis-report__views" aria-label="Investigation views">
        <button
          type="button"
          aria-pressed={view === 'report'}
          onClick={() => setView('report')}
        >
          Investigation report
        </button>
        <button
          type="button"
          aria-pressed={view === 'graph'}
          onClick={() => setView('graph')}
        >
          Evidence graph
        </button>
        <button
          type="button"
          aria-pressed={view === 'verification'}
          onClick={() => setView('verification')}
        >
          Verification plan
        </button>
      </div>
      <div hidden={view !== 'report'}>
        <div className="analysis-report__folio">
          Investigation report / {report.analysisId.slice(0, 8)}
        </div>
        <p className="workspace-kicker">
          Case {report.caseId} · {new Date(report.analyzedAt).toLocaleString()}{' '}
          · {report.sourceType} · analysis complete
        </p>
        <h3 id="report-heading">
          The evidence, <em>in context.</em>
        </h3>
        <div className="analysis-report__overview">
          <div>
            <span>Warning-sign index</span>
            <strong>
              {report.risk.score}
              <small> / 100</small>
            </strong>
            <b>{report.risk.classification}</b>
          </div>
          <p>
            {report.summary}
            <br />
            <small>{report.risk.explanation}</small>
          </p>
        </div>
        <section aria-labelledby="findings-heading">
          <h4 id="findings-heading">01 / Supported findings</h4>
          {report.findings.length ? (
            <ol className="analysis-report__findings">
              {report.findings.map((finding) => (
                <li key={finding.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(finding.id);
                      setSourceHighlight(null);
                    }}
                    aria-pressed={selected === finding.id}
                  >
                    <span>
                      {finding.id} · {finding.severity} severity ·{' '}
                      {finding.uncertainty} uncertainty
                    </span>
                    <strong>{finding.title}</strong>
                    <q>{finding.quotation}</q>
                    <p>{finding.explanation}</p>
                    <small>
                      Source: {finding.origin.replaceAll('_', ' ')} · AI
                      interpretation, not independently verified
                    </small>
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <p>
              No supported warning signs were identified. This is not a safety
              verdict.
            </p>
          )}
        </section>
        <section aria-labelledby="evidence-heading-report" ref={sourceRef}>
          <h4 id="evidence-heading-report">02 / Reviewed source evidence</h4>
          <p className="analysis-report__source">
            {validSpan ? (
              <>
                {text.slice(0, validSpan.start)}
                <mark>{text.slice(validSpan.start, validSpan.end)}</mark>
                {text.slice(validSpan.end)}
              </>
            ) : (
              text
            )}
          </p>
          <p className="analysis-report__note">
            Select a finding to locate its exact quotation in the confirmed
            text. The source's claims have not been independently verified.
          </p>
        </section>
        <section>
          <h4>03 / Unanswered questions</h4>
          {report.claims.length > 0 && (
            <div className="analysis-report__claims">
              <strong>Claims observed in the source / unverified</strong>
              <ul>
                {report.claims.map((claim, i) => (
                  <li key={i}>
                    {claim.text} — <q>{claim.quotation}</q>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <ul>
            {[
              ...report.missingInformation,
              ...report.uncertaintyIndicators,
              ...report.limitations,
            ].map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </section>
        <section>
          <h4>04 / Independent next steps</h4>
          <ol>
            {report.recommendedActions.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ol>
        </section>
        <p className="analysis-report__disclaimer">
          Risk assessment is not proof of fraud. Independently verify the
          opportunity before sharing money or sensitive information. Model:{' '}
          {report.model}. {report.rejectedEvidenceCount} unsupported or
          duplicate evidence item(s) excluded.
        </p>
        {sourceHighlight && (
          <button
            type="button"
            className="analysis-report__back"
            onClick={() => setView('graph')}
          >
            Return to evidence graph ↗
          </button>
        )}
      </div>
      <div hidden={view !== 'graph'}>
        <Suspense fallback={<p role="status">Opening evidence graph…</p>}>
          <EvidenceGraph
            report={report}
            reviewedText={text}
            active={view === 'graph'}
            verificationActions={plan.actions}
            focusFindingId={graphFocus.findingId}
            focusRequest={graphFocus.request}
            onOpenVerification={(findingId, actionId) => {
              setVerificationFocus((current) => ({
                findingId,
                actionId,
                request: current.request + 1,
              }));
              setView('verification');
            }}
            onTrace={(start, end) => {
              if (!sourceSpan(text, text.slice(start, end), start, end)) return;
              setSourceHighlight({ start, end });
              setView('report');
            }}
          />
        </Suspense>
      </div>
      <div hidden={view !== 'verification'}>
        <Suspense fallback={<p role="status">Opening verification plan…</p>}>
          <VerificationWorkspace
            plan={plan}
            active={view === 'verification'}
            focusFindingId={verificationFocus.findingId}
            focusActionId={verificationFocus.actionId}
            focusRequest={verificationFocus.request}
            onViewFinding={(findingId) => {
              setGraphFocus((current) => ({
                findingId,
                request: current.request + 1,
              }));
              setView('graph');
            }}
          />
        </Suspense>
      </div>
    </article>
  );
}

export function AnalysisReview({
  result,
  previewUrl,
}: {
  result: IntakeSuccess;
  previewUrl?: string;
}) {
  const original = result.extractedText ?? '';
  const [reviewedText, setReviewedText] = useState(original);
  const [state, setState] = useState<
    'ready' | 'analyzing' | 'failed' | 'complete'
  >('ready');
  const [error, setError] = useState('');
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const analyze = async () => {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setError('');
    setState('analyzing');
    try {
      const value = await requestReport(
        result,
        reviewedText,
        original,
        controller.signal,
      );
      setReport(value);
      setState('complete');
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Analysis failed. Please try again.',
      );
      setState('failed');
    } finally {
      pending.current = null;
    }
  };
  return (
    <div className="analysis-review">
      <div className="analysis-review__heading">
        <span>02 / Review before analysis</span>
        <h3>
          Confirm what the source <em>actually says.</em>
        </h3>
        <p>
          Correct transcription errors and remove personal information you do
          not want to share. The original extraction stays visible above and is
          kept separately in this browser view.
        </p>
      </div>
      {previewUrl && result.sourceType === 'image' && (
        <div className="analysis-review__image">
          <span>Original screenshot / local preview</span>
          <img
            src={previewUrl}
            alt="Original uploaded screenshot for comparison with OCR text"
          />
        </div>
      )}
      {result.sourceType === 'image' && (
        <p className="analysis-review__ocr">
          Check payment amounts against the original document. OCR may misread
          currency symbols or digits.
        </p>
      )}
      <label htmlFor="reviewed-source">
        Reviewed source text /{' '}
        {reviewedText !== original ? 'user-edited' : 'original extracted text'}
      </label>
      <textarea
        id="reviewed-source"
        value={reviewedText}
        disabled={state === 'analyzing'}
        onChange={(event) => {
          setReviewedText(event.target.value);
          setReport(null);
          setState('ready');
        }}
        maxLength={20_000}
        rows={10}
        spellCheck={false}
      />
      <p className="analysis-review__disclosure">
        By selecting Analyze Opportunity, you confirm this reviewed text and
        send it to Groq, an external AI provider. Uploaded file bytes are not
        sent. If you leave the text unchanged, the confirmed text is the
        original extraction. This analysis does not independently verify an
        employer or opportunity.
      </p>
      {state === 'failed' && (
        <p role="alert" className="analysis-review__error">
          {error}
        </p>
      )}
      {state === 'analyzing' && (
        <p role="status">
          Analyzing the confirmed text. Results will be validated before
          display…
        </p>
      )}
      <button
        type="button"
        className="submit-source"
        onClick={analyze}
        disabled={state === 'analyzing' || reviewedText.trim().length < 20}
      >
        {state === 'failed'
          ? 'Retry analysis'
          : state === 'complete'
            ? 'Analyze again'
            : 'Analyze Opportunity'}{' '}
        <span aria-hidden="true">↗</span>
      </button>
      {report && state === 'complete' && (
        <Report key={report.analysisId} report={report} text={reviewedText} />
      )}
    </div>
  );
}
