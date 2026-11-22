import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { IntakeSuccess, SourceType } from '../../shared/contracts';
import {
  FileSourceInput,
  SourceTypeSelector,
  TextSourceInput,
  UrlSourceInput,
  sourceLabels,
} from './SourceInputs';
import './workspace.css';
import { readIntakeResponse } from './readIntakeResponse';

type Stage =
  'empty' | 'editing' | 'validating' | 'processing' | 'success' | 'failed';

function validate(
  type: SourceType,
  text: string,
  url: string,
  file: File | null,
): string | null {
  if (type === 'text') {
    if (!text.trim()) return 'Enter the opportunity text before continuing.';
    if (text.length > 20_000) return 'Text must be 20,000 characters or fewer.';
  }
  if (type === 'url') {
    if (!url.trim()) return 'Enter an opportunity URL before continuing.';
    let parsed: URL;
    try {
      parsed = new URL(url.trim());
    } catch {
      return 'Enter a valid HTTP or HTTPS URL.';
    }
    if (!['http:', 'https:'].includes(parsed.protocol))
      return 'Only HTTP and HTTPS URLs are supported.';
    if (parsed.username || parsed.password)
      return 'Remove the username and password from this URL.';
    if (parsed.toString().length > 2_048)
      return 'URLs must be 2,048 characters or fewer.';
  }
  if (type === 'image' || type === 'pdf') {
    if (!file)
      return `Choose a ${type === 'image' ? 'screenshot' : 'PDF'} before continuing.`;
    const allowed =
      type === 'image'
        ? ['image/png', 'image/jpeg', 'image/webp']
        : ['application/pdf'];
    if (!allowed.includes(file.type))
      return type === 'image'
        ? 'Choose a PNG, JPEG or WebP image.'
        : 'Choose a PDF document.';
    if (file.size === 0) return 'The selected file is empty.';
    if (file.size > (type === 'image' ? 5 : 10) * 1024 * 1024)
      return `${type === 'image' ? 'Screenshots' : 'PDFs'} must be ${type === 'image' ? '5' : '10'} MB or smaller.`;
  }
  return null;
}

function PreparedSource({
  result,
  onReset,
}: {
  result: IntakeSuccess;
  onReset: () => void;
}) {
  const processingStatus =
    result.processingStatus ??
    (result.extractedText ? 'extracted' : 'unavailable');
  const statusLabel: Record<string, string> = {
    supplied: 'Text supplied by you',
    extracted: 'Readable text extracted',
    partial: 'Partially extracted',
    unavailable: 'Text extraction unavailable',
    failed: 'Text extraction failed',
  };
  const methodLabel: Record<string, string> = {
    user_supplied: 'User supplied text',
    html_text: 'Webpage HTML text',
    plain_text: 'Webpage plain text',
    image_ocr: 'Screenshot OCR text',
    pdf_text: 'Selectable PDF text',
    none: 'No extraction',
  };
  const method =
    result.extractionMethod ??
    (result.sourceType === 'text'
      ? 'user_supplied'
      : result.sourceType === 'pdf'
        ? 'pdf_text'
        : 'none');
  return (
    <section className="prepared" aria-labelledby="prepared-heading">
      <div className="prepared__stamp" aria-hidden="true">
        Source received / 01
      </div>
      <p className="workspace-kicker">Investigation file / prepared</p>
      <h2 id="prepared-heading">
        Your source is{' '}
        {processingStatus === 'unavailable' ? 'recorded' : 'ready'}
        <br />
        <em>for closer examination.</em>
      </h2>
      <p className="prepared__lead">
        Source processing is not an authenticity or safety verification. AI risk
        assessment has not yet been performed; no organization or claim has been
        verified.
      </p>
      <dl className="prepared__metadata">
        <div>
          <dt>Case identifier</dt>
          <dd className="prepared__case">{result.caseId}</dd>
        </div>
        <div>
          <dt>Source type</dt>
          <dd>{sourceLabels[result.sourceType]}</dd>
        </div>
        <div>
          <dt>Processing status</dt>
          <dd>{statusLabel[processingStatus]}</dd>
        </div>
        <div>
          <dt>Extraction method</dt>
          <dd>{methodLabel[method]}</dd>
        </div>
        <div>
          <dt>Received</dt>
          <dd>
            <time dateTime={result.submittedAt}>
              {new Date(result.submittedAt).toLocaleString()}
            </time>
          </dd>
        </div>
        {result.metadata.normalizedUrl && (
          <div>
            <dt>Recorded URL</dt>
            <dd className="prepared__case">{result.metadata.normalizedUrl}</dd>
          </div>
        )}
        {result.metadata.pageTitle && (
          <div>
            <dt>Page title</dt>
            <dd>{result.metadata.pageTitle}</dd>
          </div>
        )}
        {result.provenance?.finalUrl && (
          <div>
            <dt>Retrieved from</dt>
            <dd className="prepared__case">{result.provenance.finalUrl}</dd>
          </div>
        )}
        {result.provenance?.retrievedAt && (
          <div>
            <dt>Retrieved</dt>
            <dd>
              <time dateTime={result.provenance.retrievedAt}>
                {new Date(result.provenance.retrievedAt).toLocaleString()}
              </time>
            </dd>
          </div>
        )}
        {result.metadata.fileName && (
          <div>
            <dt>File</dt>
            <dd>
              {result.metadata.fileName}
              {result.metadata.pageCount
                ? ` · ${result.metadata.pageCount} page${result.metadata.pageCount === 1 ? '' : 's'}`
                : ''}
            </dd>
          </div>
        )}
      </dl>
      {result.extractedText && (
        <div className="prepared__extract">
          <div className="prepared__extract-heading">
            <span>
              {result.sourceType === 'text'
                ? 'User-submitted text'
                : result.sourceType === 'url'
                  ? 'Retrieved webpage text'
                  : result.sourceType === 'image'
                    ? 'Screenshot OCR text'
                    : 'Extracted PDF text'}
            </span>
            <span>
              {result.extractedText.length.toLocaleString()} characters
            </span>
          </div>
          <p>{result.extractedText}</p>
        </div>
      )}
      {result.warnings.length > 0 && (
        <div className="prepared__warnings">
          <strong>Preparation notes</strong>
          <ul>
            {result.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
      {result.errors && result.errors.length > 0 && (
        <p className="prepared__limitations">
          Processing limitation: {result.errors.join(', ').replaceAll('_', ' ')}
          .
        </p>
      )}
      <button type="button" className="submit-source" onClick={onReset}>
        Start another investigation <span aria-hidden="true">↗</span>
      </button>
    </section>
  );
}

export function InvestigationWorkspace() {
  const [sourceType, setSourceType] = useState<SourceType>('text');
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [pdf, setPdf] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [stage, setStage] = useState<Stage>('empty');
  const [error, setError] = useState('');
  const [result, setResult] = useState<IntakeSuccess | null>(null);
  const [controller, setController] = useState<AbortController | null>(null);
  const currentFile =
    sourceType === 'image' ? image : sourceType === 'pdf' ? pdf : null;
  const busy = stage === 'validating' || stage === 'processing';

  useEffect(() => {
    if (!image) {
      setPreviewUrl(undefined);
      return;
    }
    const objectUrl = URL.createObjectURL(image);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [image]);
  useEffect(() => () => controller?.abort(), [controller]);

  const edit = () => {
    setStage('editing');
    setError('');
  };
  const reset = () => {
    setSourceType('text');
    setText('');
    setUrl('');
    setImage(null);
    setPdf(null);
    setResult(null);
    setError('');
    setStage('empty');
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStage('validating');
    setError('');
    const validationError = validate(sourceType, text, url, currentFile);
    if (validationError) {
      setError(validationError);
      setStage('failed');
      return;
    }
    const requestController = new AbortController();
    setController(requestController);
    setStage('processing');
    try {
      const fileRequest = sourceType === 'image' || sourceType === 'pdf';
      const response = await fetch('/api/intake', {
        method: 'POST',
        headers: fileRequest
          ? {
              'Content-Type': 'application/octet-stream',
              'X-Source-Type': sourceType,
              'X-File-Name': encodeURIComponent(currentFile!.name),
            }
          : { 'Content-Type': 'application/json' },
        body: fileRequest
          ? currentFile
          : JSON.stringify(
              sourceType === 'text'
                ? { sourceType, text }
                : { sourceType, url },
            ),
        signal: requestController.signal,
      });
      const payload = await readIntakeResponse(response);
      setResult(payload);
      setStage('success');
    } catch (cause) {
      setError(
        cause instanceof DOMException && cause.name === 'AbortError'
          ? 'Submission cancelled. Your source is still here.'
          : cause instanceof Error
            ? cause.message
            : 'The source could not be prepared. Please try again.',
      );
      setStage('failed');
    } finally {
      setController(null);
    }
  };

  return (
    <main id="main" className="workspace page-width">
      <div className="workspace__intro">
        <div>
          <p className="workspace-kicker">
            <span className="eyebrow__dash" /> ProofPath / new investigation
          </p>
          <h1>
            Every investigation <br />
            begins <em>with a source.</em>
          </h1>
          <p className="workspace__support">
            Share the opportunity exactly as you received it. ProofPath will
            prepare the information for closer examination.
          </p>
        </div>
        <p className="workspace__folio">
          Case intake <span>↓</span>
          <br />
          Step 01 / Source
        </p>
      </div>
      {stage === 'success' && result ? (
        <PreparedSource result={result} onReset={reset} />
      ) : (
        <div className="workspace__body">
          <div className="workspace__aside">
            <span className="workspace__section-number">
              01 / Submit a source
            </span>
            <h2>
              What did you
              <br />
              <em>receive?</em>
            </h2>
            <p>
              Choose one source at a time. Your entries stay here while you
              switch methods. Nothing is stored permanently during this phase.
            </p>
            <div className="workspace__aside-rule">
              <span>Receive</span>
              <span>Prepare</span>
              <span>Examine later</span>
            </div>
          </div>
          <form className="intake-form" onSubmit={submit} noValidate>
            <div className="intake-form__top">
              <span>Source format</span>
              <span>Select 01 of 04</span>
            </div>
            <SourceTypeSelector
              value={sourceType}
              onChange={(type) => {
                setSourceType(type);
                edit();
              }}
              disabled={busy}
            />
            {sourceType === 'text' && (
              <TextSourceInput
                value={text}
                onChange={(value) => {
                  setText(value);
                  edit();
                }}
                disabled={busy}
              />
            )}
            {sourceType === 'url' && (
              <UrlSourceInput
                value={url}
                onChange={(value) => {
                  setUrl(value);
                  edit();
                }}
                disabled={busy}
              />
            )}
            {sourceType === 'image' && (
              <FileSourceInput
                type="image"
                file={image}
                onChange={(file) => {
                  setImage(file);
                  edit();
                }}
                disabled={busy}
                previewUrl={previewUrl}
              />
            )}
            {sourceType === 'pdf' && (
              <FileSourceInput
                type="pdf"
                file={pdf}
                onChange={(file) => {
                  setPdf(file);
                  edit();
                }}
                disabled={busy}
              />
            )}
            {error && (
              <div className="intake-form__error" role="alert">
                <span>Attention /</span> {error}
              </div>
            )}
            {busy && (
              <p className="intake-form__status" role="status">
                {stage === 'validating'
                  ? 'Checking source…'
                  : sourceType === 'pdf'
                    ? 'Extracting document text…'
                    : 'Preparing source…'}
              </p>
            )}
            <div className="intake-form__bottom">
              <p>
                Source preparation only.
                <br />
                No risk assessment is performed yet.
              </p>
              <div>
                {busy && (
                  <button
                    type="button"
                    className="minor-action"
                    onClick={() => controller?.abort()}
                  >
                    Cancel
                  </button>
                )}
                <button type="submit" className="submit-source" disabled={busy}>
                  Prepare source <span aria-hidden="true">↗</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
      <div className="workspace__return">
        <a href="/">← Return to the investigation</a>
        <span>ProofPath / Verify before you trust</span>
      </div>
    </main>
  );
}
