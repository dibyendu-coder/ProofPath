import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { buildCommunicationDrafts } from './buildVerificationPlan';
import {
  initializeVerification,
  verificationProgress,
  verificationReducer,
} from './verificationReducer';
import type {
  EvidenceNote,
  VerificationAction,
  VerificationPlan,
  VerificationState,
} from './types';
import './verification.css';

const statusLabel: Record<VerificationAction['status'], string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  response_recorded: 'Response recorded',
  complete: 'User marked complete',
  concern_unresolved: 'Concern unresolved',
};

async function copyText(text: string) {
  if (!navigator.clipboard?.writeText)
    throw new Error(
      'Clipboard unavailable in this browser. Select and copy the text manually.',
    );
  await navigator.clipboard.writeText(text);
}

export function VerificationWorkspace({
  plan,
  active,
  focusFindingId,
  focusActionId,
  focusRequest,
  onViewFinding,
  onStateChange,
}: {
  plan: VerificationPlan;
  active: boolean;
  focusFindingId: string | null;
  focusActionId?: string;
  focusRequest: number;
  onViewFinding: (id: string) => void;
  onStateChange?: (state: VerificationState) => void;
}) {
  const [state, dispatch] = useReducer(verificationReducer, plan, (value) =>
    initializeVerification(value, new Date().toISOString()),
  );
  useEffect(() => onStateChange?.(state), [state, onStateChange]);
  const [selectedId, setSelectedId] = useState(plan.actions[0]?.id ?? null);
  const [noteKind, setNoteKind] = useState<'note' | 'response'>('note');
  const [noteText, setNoteText] = useState('');
  const [referenceUrl, setReferenceUrl] = useState('');
  const [outcome, setOutcome] = useState<EvidenceNote['outcome']>('pending');
  const [message, setMessage] = useState('');
  const drafts = useMemo(() => buildCommunicationDrafts(), []);
  const [draftId, setDraftId] = useState(drafts[0].id);
  const [draftText, setDraftText] = useState<Record<string, string>>(() =>
    Object.fromEntries(drafts.map((draft) => [draft.id, draft.text])),
  );
  const selected =
    state.actions.find((action) => action.id === selectedId) ??
    state.actions[0];
  const section = useRef<HTMLElement>(null);
  const progress = verificationProgress(state.actions);
  useEffect(() => {
    if (!active || !focusRequest) return;
    const action = state.actions.find(
      (item) =>
        item.id === focusActionId ||
        (focusFindingId && item.findingIds.includes(focusFindingId)),
    );
    if (action) {
      setSelectedId(action.id);
      section.current?.scrollIntoView?.({ block: 'start' });
    }
  }, [active, focusFindingId, focusActionId, focusRequest, state.actions]);
  const change = (type: 'start' | 'complete' | 'reopen' | 'unresolved') => {
    if (!selected) return;
    dispatch({ type, actionId: selected.id, at: new Date().toISOString() });
  };
  const record = () => {
    if (!selected) return;
    const trimmed = noteText.trim();
    if (!trimmed || trimmed.length > 1000) {
      setMessage('Enter 1–1,000 characters before recording.');
      return;
    }
    if (referenceUrl.trim()) {
      try {
        const value = new URL(referenceUrl.trim());
        if (!['http:', 'https:'].includes(value.protocol)) throw new Error();
      } catch {
        setMessage(
          'Enter a valid HTTP or HTTPS reference URL, or leave it blank.',
        );
        return;
      }
    }
    dispatch({
      type: 'record',
      actionId: selected.id,
      at: new Date().toISOString(),
      kind: noteKind,
      text: trimmed,
      referenceUrl: referenceUrl.trim(),
      outcome,
    });
    setNoteText('');
    setReferenceUrl('');
    setOutcome('pending');
    setMessage(
      `${noteKind === 'response' ? 'Response' : 'Note'} recorded locally.`,
    );
  };
  const copy = async (text: string, label: string) => {
    try {
      await copyText(text);
      setMessage(`${label} copied.`);
    } catch (cause) {
      setMessage(
        cause instanceof Error
          ? cause.message
          : 'Copy failed. Select the text manually.',
      );
    }
  };
  return (
    <section
      className="verification-workspace"
      aria-label="Verification plan"
      ref={section}
    >
      <header className="verification-workspace__header">
        <span>03 / Verification desk · case {plan.caseId.slice(0, 8)}</span>
        <h3>
          Make the next check <em>count.</em>
        </h3>
        <p>
          Each step is tied to a supported finding, a missing detail, a report
          recommendation, or general safety guidance. Your notes and progress
          stay in this browser view until you refresh or leave.
        </p>
      </header>
      <div
        className="verification-workspace__progress"
        aria-label="Verification progress"
      >
        <div>
          <strong>
            {progress.completed}
            <small> / {progress.total}</small>
          </strong>
          <span>User-marked actions complete</span>
        </div>
        <div>
          <strong>{progress.started}</strong>
          <span>Started</span>
        </div>
        <div>
          <strong>{progress.remaining}</strong>
          <span>Remaining</span>
        </div>
        <div>
          <strong>{progress.unresolvedHigh}</strong>
          <span>Unresolved high priority</span>
        </div>
        <progress
          value={progress.completed}
          max={Math.max(progress.total, 1)}
          aria-label="Checklist completion"
        />
        <p>
          Checklist completion measures your activity only. It does not reduce
          the warning-sign index or verify an organization.
        </p>
      </div>
      <div className="verification-workspace__body">
        <nav
          className="verification-workspace__actions"
          aria-label="Prioritized verification actions"
        >
          <h4>Priority checks</h4>
          <ol>
            {state.actions.map((action, index) => (
              <li key={action.id}>
                <button
                  type="button"
                  aria-current={selected?.id === action.id ? 'step' : undefined}
                  onClick={() => {
                    setSelectedId(action.id);
                    setMessage('');
                  }}
                >
                  <span>
                    {String(index + 1).padStart(2, '0')} / {action.priority}{' '}
                    priority
                  </span>
                  <strong>{action.title}</strong>
                  <small>{statusLabel[action.status]}</small>
                </button>
              </li>
            ))}
          </ol>
        </nav>
        {selected && (
          <div
            className="verification-workspace__detail"
            aria-label="Selected verification action"
          >
            <div className="verification-workspace__detail-head">
              <span>
                {selected.basis.replaceAll('_', ' ')} / {selected.priority}{' '}
                priority
              </span>
              <h4>{selected.title}</h4>
              <p>{selected.description}</p>
            </div>
            <dl>
              <div>
                <dt>Status</dt>
                <dd>{statusLabel[selected.status]} · reported by you</dd>
              </div>
              <div>
                <dt>Suggested method</dt>
                <dd>{selected.method}</dd>
              </div>
              <div>
                <dt>Completion criterion</dt>
                <dd>{selected.completionCriteria}</dd>
              </div>
            </dl>
            {selected.evidence.length > 0 && (
              <div className="verification-workspace__evidence">
                <h5>Source quotation / unverified</h5>
                {selected.evidence.map((item, i) => (
                  <blockquote key={`${item.start}:${item.end}:${i}`}>
                    {item.quotation}
                    <small>
                      {item.origin.replaceAll('_', ' ')} · reviewed text{' '}
                      {item.start}–{item.end}
                    </small>
                  </blockquote>
                ))}
              </div>
            )}
            {selected.findingIds.length > 0 && (
              <div className="verification-workspace__related">
                <h5>Supported findings</h5>
                {selected.findingIds.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onViewFinding(id)}
                  >
                    View finding {id} in graph ↗
                  </button>
                ))}
              </div>
            )}
            <div
              className="verification-workspace__controls"
              aria-label="Update action status"
            >
              {selected.status === 'not_started' && (
                <button type="button" onClick={() => change('start')}>
                  Start action
                </button>
              )}
              {selected.status !== 'not_started' &&
                selected.status !== 'complete' && (
                  <button type="button" onClick={() => change('complete')}>
                    Mark complete
                  </button>
                )}
              {selected.status !== 'concern_unresolved' &&
                selected.status !== 'complete' && (
                  <button type="button" onClick={() => change('unresolved')}>
                    Mark concern unresolved
                  </button>
                )}
              {['complete', 'concern_unresolved'].includes(selected.status) && (
                <button type="button" onClick={() => change('reopen')}>
                  Reopen action
                </button>
              )}
            </div>
            <section className="verification-workspace__questions">
              <h5>Questions to ask</h5>
              <ol>
                {selected.questions.map((question, i) => (
                  <li key={i}>
                    <span>{question}</span>
                    <button
                      type="button"
                      onClick={() => copy(question, 'Question')}
                    >
                      Copy question
                    </button>
                  </li>
                ))}
              </ol>
            </section>
            <section className="verification-workspace__notes">
              <h5>Evidence notes / your account</h5>
              <p>
                Record what you observed. Replies and links entered here are not
                independently verified or sent to Groq.
              </p>
              <div className="verification-workspace__note-form">
                <label>
                  Entry type
                  <select
                    value={noteKind}
                    onChange={(event) =>
                      setNoteKind(event.target.value as 'note' | 'response')
                    }
                  >
                    <option value="note">My observation</option>
                    <option value="response">
                      Recruiter or organization response
                    </option>
                  </select>
                </label>
                <label>
                  Text
                  <textarea
                    value={noteText}
                    maxLength={1000}
                    rows={4}
                    onChange={(event) => setNoteText(event.target.value)}
                    placeholder="Record the response or observation in your own words."
                  />
                </label>
                <label>
                  Reference URL / optional, recorded as text only
                  <input
                    type="url"
                    value={referenceUrl}
                    maxLength={500}
                    onChange={(event) => setReferenceUrl(event.target.value)}
                    placeholder="https://"
                  />
                </label>
                <label>
                  Reported outcome
                  <select
                    value={outcome}
                    onChange={(event) =>
                      setOutcome(event.target.value as EvidenceNote['outcome'])
                    }
                  >
                    <option value="pending">Still pending</option>
                    <option value="helpful">
                      Helpful information received
                    </option>
                    <option value="unresolved">Concern unresolved</option>
                  </select>
                </label>
                <button type="button" onClick={record}>
                  Record entry
                </button>
              </div>
              {selected.notes.length > 0 && (
                <ol className="verification-workspace__recorded">
                  {selected.notes.map((note) => (
                    <li key={note.id}>
                      <strong>
                        {note.kind === 'response'
                          ? 'Response reported'
                          : 'Observation recorded'}
                      </strong>
                      <time dateTime={note.recordedAt}>
                        {new Date(note.recordedAt).toLocaleString()}
                      </time>
                      <p>{note.text}</p>
                      {note.referenceUrl && (
                        <small>Reference text: {note.referenceUrl}</small>
                      )}
                      <small>Reported outcome: {note.outcome}</small>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        )}
      </div>
      <section className="verification-workspace__drafts">
        <h4>Communication drafts</h4>
        <p>
          Edit before copying. Nothing is sent automatically; no recipient
          address is supplied.
        </p>
        <label>
          Draft purpose
          <select
            value={draftId}
            onChange={(event) => setDraftId(event.target.value)}
          >
            {drafts.map((draft) => (
              <option key={draft.id} value={draft.id}>
                {draft.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Editable message
          <textarea
            rows={9}
            maxLength={3000}
            value={draftText[draftId]}
            onChange={(event) =>
              setDraftText((current) => ({
                ...current,
                [draftId]: event.target.value,
              }))
            }
          />
        </label>
        <button type="button" onClick={() => copy(draftText[draftId], 'Draft')}>
          Copy edited draft
        </button>
      </section>
      <section className="verification-workspace__timeline">
        <h4>Investigation timeline</h4>
        <p>
          Actions in this browser session only. ProofPath has not contacted
          anyone.
        </p>
        <ol>
          {[...state.timeline].reverse().map((event) => (
            <li key={event.id}>
              <time dateTime={event.at}>
                {new Date(event.at).toLocaleString()}
              </time>
              <span>{event.label}</span>
            </li>
          ))}
        </ol>
      </section>
      {message && (
        <p className="verification-workspace__message" role="status">
          {message}
        </p>
      )}
      <p className="verification-workspace__safety">
        A completed checklist does not establish authenticity. Confirm important
        details through channels you locate independently. Do not send money or
        sensitive documents to an unverified recruiter.
      </p>
    </section>
  );
}
