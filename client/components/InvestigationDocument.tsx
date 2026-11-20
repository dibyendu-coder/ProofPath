import { useState } from 'react';

type SignalId = 'payment' | 'urgency' | 'channel' | 'identity';

const signals: Record<
  SignalId,
  { number: string; title: string; explanation: string; question: string }
> = {
  payment: {
    number: '01',
    title: 'A payment before the placement',
    explanation:
      'An upfront “verification” fee can be a warning sign, especially when the offer has not been confirmed through an official channel.',
    question:
      'Does the organization list any legitimate fee on its official website?',
  },
  urgency: {
    number: '02',
    title: 'A clock that discourages checking',
    explanation:
      'A short deadline can pressure you to act before you verify the sender, the role, or the payment request.',
    question:
      'Can the recruiter confirm the deadline through a published company contact?',
  },
  channel: {
    number: '03',
    title: 'A contact you cannot trace',
    explanation:
      'Moving a recruitment conversation to a personal messaging account makes the sender harder to connect to an organization.',
    question: 'Is this recruiter listed on an official company channel?',
  },
  identity: {
    number: '04',
    title: 'A missing organization',
    explanation:
      'Withholding the company name prevents an independent check of the employer and the internship itself.',
    question:
      'Can you find the same role on the organization’s own careers page?',
  },
};

export function InvestigationDocument() {
  const [active, setActive] = useState<SignalId | null>(null);
  const [visited, setVisited] = useState<SignalId[]>([]);

  function inspect(id: SignalId) {
    setActive(id);
    setVisited((current) =>
      current.includes(id) ? current : [...current, id],
    );
  }

  function phrase(id: SignalId, copy: string) {
    return (
      <button
        className={`document-phrase${active === id ? ' document-phrase--active' : ''}`}
        type="button"
        aria-pressed={active === id}
        aria-controls="annotation-panel"
        onClick={() => inspect(id)}
      >
        {copy}
        <span className="document-phrase__mark" aria-hidden="true">
          {signals[id].number}
        </span>
      </button>
    );
  }

  function ask(id: SignalId, copy: string) {
    return (
      <div className="offer-letter__ask" key={id}>
        <p>{phrase(id, copy)}</p>
        {active === id && (
          <div className="inline-note" role="status">
            <strong>{signals[id].title}</strong>
            <p>{signals[id].explanation}</p>
            <span>Ask before you act</span>
            <p>{signals[id].question}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="investigation">
      <div className="investigation__meta">
        <p>Interactive fictional demonstration — not a live verification.</p>
        <p>Select the marked phrases</p>
      </div>
      <div className="case-file">
        <div className="case-file__top">
          <span>Exhibit A / Internship offer</span>
          <span>Fictional sample · 001</span>
        </div>
        <div className="case-file__content">
          <article
            className="offer-letter"
            aria-label="Fictional internship offer"
          >
            <div className="offer-letter__stamp" aria-hidden="true">
              REVIEW
              <br />
              THE DETAILS
            </div>
            <p className="offer-letter__label">
              Subject / Shortlisted for internship
            </p>
            <h3>Dear candidate,</h3>
            <p>
              Congratulations! You have been shortlisted for a Software
              Development Internship.
            </p>
            <p>
              Before we release your offer letter, please complete the
              following:
            </p>
            <div className="offer-letter__asks">
              {ask('payment', 'Complete your verification payment of ₹999.')}
              {ask('urgency', 'Your offer expires in 30 minutes.')}
              {ask(
                'channel',
                'Contact our recruiter using this personal messaging account.',
              )}
              {ask('identity', 'We will share the company name after payment.')}
            </div>
            <p>We look forward to hearing from you.</p>
            <p className="offer-letter__signature">
              Recruitment desk
              <br />
              <span>Sent without verifiable organization details</span>
            </p>
          </article>
          <aside
            className="annotation"
            id="annotation-panel"
            aria-label="Investigation annotation"
            aria-live="polite"
          >
            <span className="annotation__eyebrow">
              Field note / {active ? signals[active].number : '—'}
            </span>
            {active ? (
              <div className="annotation__content" key={active}>
                <span className="annotation__line" aria-hidden="true" />
                <h4>{signals[active].title}</h4>
                <p>{signals[active].explanation}</p>
                <div className="annotation__question">
                  <span>Ask before you act</span>
                  <p>{signals[active].question}</p>
                </div>
              </div>
            ) : (
              <div className="annotation__content annotation__content--empty">
                <span className="annotation__line" aria-hidden="true" />
                <h4>Look closer.</h4>
                <p>
                  Select any marked phrase in the offer to reveal a potential
                  warning sign and a question worth asking.
                </p>
              </div>
            )}
            <div className="annotation__progress">
              <div>
                <span>Details inspected</span>
                <strong>{visited.length} / 4</strong>
              </div>
              <progress
                aria-label="Details inspected"
                max={4}
                value={visited.length}
              />
              <p>This tracks what you opened, not the offer’s safety.</p>
            </div>
          </aside>
        </div>
        <div className="case-file__bottom">
          <span>ProofPath / field notes</span>
          <span>Observe · Question · Verify</span>
        </div>
      </div>
    </div>
  );
}
