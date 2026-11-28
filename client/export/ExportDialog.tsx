import { useEffect, useRef, useState } from 'react';
import type { AnalysisReport, IntakeSuccess } from '../../shared/contracts';
import type {
  VerificationPlan,
  VerificationState,
} from '../verification/types';
import { buildReportSnapshot } from './buildReportSnapshot';
import { downloadBlob, exportJson, reportFilename } from './exportJson';
import { ReportPreview } from './ReportPreview';
import { defaultExportOptions } from './types';
import type { ExportOptions, ReportSnapshot } from './types';
import './export.css';

const toggles: Array<{
  key: Exclude<keyof ExportOptions, 'redactTerms'>;
  label: string;
}> = [
  { key: 'includeSource', label: 'Full reviewed source text' },
  { key: 'includeQuotations', label: 'Evidence quotations' },
  { key: 'includeContacts', label: 'Contact information in included text' },
  { key: 'includeSourceUrls', label: 'Source and reference URLs' },
  { key: 'includeNotes', label: 'Private verification notes and responses' },
  { key: 'includeTimeline', label: 'Local investigation timeline' },
  { key: 'includeGraph', label: 'Evidence relationship map' },
  { key: 'fingerprint', label: 'SHA-256 payload fingerprint' },
];

export function ExportDialog({
  report,
  result,
  reviewedText,
  plan,
  verification,
  onClose,
}: {
  report: AnalysisReport;
  result: IntakeSuccess;
  reviewedText: string;
  plan: VerificationPlan;
  verification: VerificationState | null;
  onClose: () => void;
}) {
  const [options, setOptions] = useState<ExportOptions>(defaultExportOptions);
  const [terms, setTerms] = useState('');
  const [snapshot, setSnapshot] = useState<ReportSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  const change = (
    key: Exclude<keyof ExportOptions, 'redactTerms'>,
    checked: boolean,
  ) => {
    setOptions((current) => ({ ...current, [key]: checked }));
    setSnapshot(null);
    setMessage('');
  };
  const updateTerms = (value: string) => {
    setTerms(value);
    setOptions((current) => ({
      ...current,
      redactTerms: value
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean),
    }));
    setSnapshot(null);
    setMessage('');
  };
  const preview = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    if (
      options.redactTerms.length > 20 ||
      options.redactTerms.some((term) => term.length > 120)
    ) {
      setError(
        'Use at most 20 redaction phrases, each 120 characters or fewer.',
      );
      setBusy(false);
      return;
    }
    try {
      setSnapshot(
        await buildReportSnapshot({
          report,
          result,
          reviewedText,
          plan,
          verification,
          options,
        }),
      );
    } catch {
      setError(
        'Could not prepare this report. Review the options and try again.',
      );
    } finally {
      setBusy(false);
    }
  };
  const download = async (type: 'pdf' | 'json') => {
    if (!snapshot) return;
    setBusy(true);
    setError('');
    setMessage('');
    const started = performance.now();
    try {
      if (type === 'json')
        downloadBlob(
          exportJson(snapshot),
          reportFilename(snapshot.caseId, 'json'),
        );
      else {
        const { exportPdf } = await import('./exportPdf');
        const bytes = await exportPdf(snapshot);
        downloadBlob(
          new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }),
          reportFilename(snapshot.caseId, 'pdf'),
        );
      }
      setMessage(
        `${type.toUpperCase()} download started in ${Math.round(performance.now() - started)} ms. Review the saved file before sharing.`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'The report could not be downloaded. Try again.',
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      className="export-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="export-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-title"
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose();
          if (event.key === 'Tab') {
            const controls = Array.from(
              event.currentTarget.querySelectorAll<HTMLElement>(
                'button:not(:disabled), input:not(:disabled), textarea:not(:disabled)',
              ),
            );
            const first = controls[0],
              last = controls.at(-1);
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <header className="export-dialog__header">
          <div>
            <span>ProofPath / private export desk</span>
            <h2 id="export-title">Prepare the report.</h2>
            <p>
              Choose what leaves this browser. Preview the exact report payload
              before downloading.
            </p>
          </div>
          <button
            type="button"
            ref={closeButton}
            onClick={onClose}
            aria-label="Close export dialog"
          >
            Close ×
          </button>
        </header>
        <div className="export-dialog__grid">
          <section
            className="export-dialog__settings"
            aria-label="Export privacy settings"
          >
            <h3>Privacy settings</h3>
            <p>
              Private notes, full source text, contacts, and URLs are excluded
              by default. Automatic redaction is imperfect; inspect the final
              files.
            </p>
            {toggles.map((toggle) => (
              <label key={toggle.key}>
                <input
                  type="checkbox"
                  checked={options[toggle.key]}
                  disabled={busy}
                  onChange={(event) => change(toggle.key, event.target.checked)}
                />
                {toggle.label}
              </label>
            ))}
            <label className="export-dialog__terms">
              Additional text to redact, one phrase per line
              <textarea
                rows={4}
                maxLength={2500}
                value={terms}
                disabled={busy}
                onChange={(event) => updateTerms(event.target.value)}
                placeholder="Enter a name or identifier to hide"
              />
            </label>
            <p>
              Up to 20 phrases, 120 characters each. Redacted quotations are
              labeled and source offsets are removed when they no longer match
              exported text. Redaction terms are never included in the export.
            </p>
            <button
              type="button"
              className="export-dialog__primary"
              disabled={busy}
              onClick={preview}
            >
              {busy
                ? 'Preparing…'
                : snapshot
                  ? 'Refresh preview'
                  : 'Generate preview'}
            </button>
          </section>
          <section
            className="export-dialog__preview"
            aria-label="Export preview"
          >
            {snapshot ? (
              <>
                <div className="export-dialog__download">
                  <div>
                    <strong>Snapshot ready</strong>
                    <small>
                      {snapshot.fingerprint
                        ? 'Fingerprint included'
                        : 'Fingerprint omitted'}{' '}
                      · {snapshot.findings.length} supported findings
                    </small>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => download('pdf')}
                  >
                    Download PDF
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => download('json')}
                  >
                    Download JSON
                  </button>
                </div>
                <ReportPreview snapshot={snapshot} />
              </>
            ) : (
              <div className="export-dialog__empty">
                <span>01 / Review first</span>
                <p>
                  Set your privacy choices, then generate a preview. The PDF and
                  JSON will use the same snapshot.
                </p>
              </div>
            )}
          </section>
        </div>
        {error && (
          <p role="alert" className="export-dialog__error">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="export-dialog__message">
            {message}
          </p>
        )}
        <footer>
          <p>
            A fingerprint helps compare files with a trusted original. It is not
            a signature or proof of authenticity. No file is uploaded or shared
            automatically.
          </p>
          <button type="button" onClick={onClose}>
            Cancel export
          </button>
        </footer>
      </div>
    </div>
  );
}
