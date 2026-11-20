import { useState } from 'react';

const signals = [
  {
    number: '01',
    label: 'Money',
    text: 'A request to pay before an offer is confirmed.',
    question:
      'Can the organization confirm the fee using contact details from its own website?',
  },
  {
    number: '02',
    label: 'Time',
    text: 'A deadline designed to outrun careful thought.',
    question:
      'Will an official recruiter confirm that deadline without asking you to act immediately?',
  },
  {
    number: '03',
    label: 'Identity',
    text: 'A recruiter or organization you cannot independently confirm.',
    question:
      'Can you find the recruiter and the role through the organization’s own channels?',
  },
] as const;

export function SignalsIndex() {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="signal-index" aria-label="Common warning signs">
      {signals.map((signal) => {
        const expanded = open === signal.number;
        const detailId = `signal-detail-${signal.number}`;

        return (
          <div
            className={`signal-index__row${expanded ? ' signal-index__row--open' : ''}`}
            key={signal.number}
          >
            <button
              type="button"
              className="signal-index__trigger"
              aria-expanded={expanded}
              aria-controls={detailId}
              onClick={() => setOpen(expanded ? null : signal.number)}
            >
              <span className="signal-index__number">
                {signal.number} / {signal.label}
              </span>
              <span className="signal-index__text">{signal.text}</span>
              <span className="signal-index__symbol" aria-hidden="true">
                {expanded ? '−' : '+'}
              </span>
            </button>
            <div
              id={detailId}
              className="signal-index__detail"
              hidden={!expanded}
            >
              <span>Question to ask</span>
              <p>{signal.question}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
