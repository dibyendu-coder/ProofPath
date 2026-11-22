import { useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import type { SourceType } from '../../shared/contracts';

export const sourceLabels: Record<SourceType, string> = {
  text: 'Paste text',
  url: 'Paste URL',
  image: 'Screenshot',
  pdf: 'PDF document',
};

export function SourceTypeSelector({
  value,
  onChange,
  disabled,
}: {
  value: SourceType;
  onChange: (value: SourceType) => void;
  disabled: boolean;
}) {
  return (
    <div
      className="source-selector"
      role="group"
      aria-label="Choose source type"
    >
      {(Object.keys(sourceLabels) as SourceType[]).map((type, index) => (
        <button
          key={type}
          type="button"
          className={`source-selector__option${value === type ? ' source-selector__option--active' : ''}`}
          aria-pressed={value === type}
          disabled={disabled}
          onClick={() => onChange(type)}
        >
          <span className="source-selector__number">0{index + 1}</span>
          <span>{sourceLabels[type]}</span>
        </button>
      ))}
    </div>
  );
}

export function TextSourceInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="source-field">
      <div className="source-field__heading">
        <label htmlFor="source-text">Opportunity as received</label>
        <span>01 / Original wording</span>
      </div>
      <textarea
        id="source-text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        maxLength={20_001}
        rows={11}
        placeholder="Paste the message, offer, or announcement here. Keep the original wording so it can be examined accurately."
        aria-describedby="text-hint text-count"
      />
      <div className="source-field__footer">
        <p id="text-hint">
          Messages, descriptions, emails and announcements are supported.
        </p>
        <output id="text-count">
          {value.length.toLocaleString()} / 20,000
        </output>
      </div>
      {value && (
        <button
          className="minor-action"
          type="button"
          onClick={() => onChange('')}
          disabled={disabled}
        >
          Clear text ↗
        </button>
      )}
    </div>
  );
}

export function UrlSourceInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  let normalized = '';
  try {
    const url = new URL(value.trim());
    if (
      ['http:', 'https:'].includes(url.protocol) &&
      !url.username &&
      !url.password
    ) {
      url.hash = '';
      normalized = url.toString();
    }
  } catch {
    /* The form reports invalid URLs on submission. */
  }
  return (
    <div className="source-field source-field--url">
      <div className="source-field__heading">
        <label htmlFor="source-url">Opportunity link</label>
        <span>02 / Address only</span>
      </div>
      <input
        id="source-url"
        type="url"
        inputMode="url"
        autoComplete="url"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        placeholder="https://example.org/opportunities/…"
        aria-describedby="url-hint"
      />
      <p id="url-hint" className="source-field__note">
        ProofPath attempts bounded text retrieval after checking the
        destination. Retrieval does not verify the website or employer.
      </p>
      {normalized && (
        <div className="normalized-url">
          <span>Normalized address</span>
          <code>{normalized}</code>
        </div>
      )}
    </div>
  );
}

function formatSize(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function FileSourceInput({
  type,
  file,
  onChange,
  disabled,
  previewUrl,
}: {
  type: 'image' | 'pdf';
  file: File | null;
  onChange: (file: File | null) => void;
  disabled: boolean;
  previewUrl?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const accept =
    type === 'image' ? 'image/png,image/jpeg,image/webp' : 'application/pdf';
  const choose = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.files?.[0] ?? null);
    event.target.value = '';
  };
  const drop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (!disabled && event.dataTransfer.files[0])
      onChange(event.dataTransfer.files[0]);
  };
  return (
    <div className="source-field">
      <div className="source-field__heading">
        <label htmlFor={`source-${type}`}>
          {type === 'image' ? 'Screenshot file' : 'PDF document'}
        </label>
        <span>
          {type === 'image' ? '03 / Visual source' : '04 / Written document'}
        </span>
      </div>
      <input
        ref={input}
        className="visually-hidden"
        id={`source-${type}`}
        type="file"
        accept={accept}
        onChange={choose}
        disabled={disabled}
      />
      <div
        className={`drop-zone${dragging ? ' drop-zone--active' : ''}`}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node))
            setDragging(false);
        }}
        onDrop={drop}
      >
        {file ? (
          <div className="selected-file">
            {type === 'image' && previewUrl && (
              <img src={previewUrl} alt="Selected screenshot preview" />
            )}
            <div>
              <span className="drop-zone__kicker">Selected source</span>
              <strong>{file.name}</strong>
              <span>
                {formatSize(file.size)} ·{' '}
                {type === 'image' ? 'Screenshot' : 'PDF document'}
              </span>
            </div>
          </div>
        ) : (
          <div className="drop-zone__empty">
            <span aria-hidden="true" className="drop-zone__symbol">
              ↥
            </span>
            <strong>
              Drop a {type === 'image' ? 'screenshot' : 'PDF'} here
            </strong>
            <span>or select a file from your device</span>
          </div>
        )}
        <div className="drop-zone__actions">
          <button
            type="button"
            className="minor-action"
            onClick={() => input.current?.click()}
            disabled={disabled}
          >
            {file ? 'Replace file' : 'Choose file'} ↗
          </button>
          {file && (
            <button
              type="button"
              className="minor-action"
              onClick={() => onChange(null)}
              disabled={disabled}
            >
              Remove
            </button>
          )}
        </div>
      </div>
      <p className="source-field__note">
        {type === 'image'
          ? 'PNG, JPEG or WebP · up to 5 MB. English OCR extracts readable text; check every detail against the screenshot.'
          : 'Text-based PDF · up to 10 MB, 15 pages and 20,000 extracted characters. Scans need OCR, which is not available yet.'}
      </p>
    </div>
  );
}
