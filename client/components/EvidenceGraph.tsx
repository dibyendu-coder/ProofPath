import { useState } from 'react';
import './EvidenceGraph.css';

type EvidenceId = 'offer' | 'recruiter' | 'payment' | 'channel';
type EvidenceStatus = 'unverified' | 'suspicious';

const evidence: Record<
  EvidenceId,
  {
    label: string;
    status: EvidenceStatus;
    title: string;
    detail: string;
    nextCheck: string;
  }
> = {
  offer: {
    label: 'Internship offer',
    status: 'unverified',
    title: 'A claim without independent confirmation',
    detail:
      'The fictional message says the candidate is shortlisted. It does not provide an official posting or an offer identifier.',
    nextCheck: 'Look for the role on the organization’s own careers page.',
  },
  recruiter: {
    label: 'Recruiter identity',
    status: 'unverified',
    title: 'The sender is still unknown',
    detail:
      'The message names a recruitment desk but gives no company name or published recruiter profile to compare.',
    nextCheck:
      'Contact the organization through a published address or phone number.',
  },
  payment: {
    label: 'Payment request',
    status: 'suspicious',
    title: 'Money is requested before confirmation',
    detail:
      'A ₹999 “verification” payment is attached to the promised offer. That request deserves scrutiny before any money or personal data is sent.',
    nextCheck:
      'Ask the organization whether this fee is part of its documented process.',
  },
  channel: {
    label: 'Communication channel',
    status: 'suspicious',
    title: 'The conversation moves away from official channels',
    detail:
      'The fictional recruiter asks for a reply through a personal messaging account, making the sender harder to connect to the organization.',
    nextCheck:
      'Continue only through a contact channel listed by the organization itself.',
  },
};

const order: EvidenceId[] = ['offer', 'recruiter', 'payment', 'channel'];

function RelationshipLines({
  mobile = false,
  active,
}: {
  mobile?: boolean;
  active: EvidenceId;
}) {
  const points = mobile
    ? {
        offer: [160, 70],
        recruiter: [80, 215],
        payment: [240, 215],
        channel: [160, 395],
      }
    : {
        offer: [300, 70],
        recruiter: [130, 215],
        payment: [470, 215],
        channel: [300, 360],
      };
  const links: { from: EvidenceId; to: EvidenceId; status: EvidenceStatus }[] =
    [
      { from: 'offer', to: 'recruiter', status: 'unverified' },
      { from: 'offer', to: 'payment', status: 'suspicious' },
      { from: 'recruiter', to: 'channel', status: 'unverified' },
      { from: 'payment', to: 'channel', status: 'suspicious' },
    ];

  return (
    <svg
      className={`evidence-graph__lines ${mobile ? 'evidence-graph__lines--mobile' : 'evidence-graph__lines--desktop'}`}
      viewBox={mobile ? '0 0 320 480' : '0 0 600 420'}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {links.map(({ from, to, status }) => (
        <line
          key={`${from}-${to}`}
          x1={points[from][0]}
          y1={points[from][1]}
          x2={points[to][0]}
          y2={points[to][1]}
          className={`evidence-graph__line evidence-graph__line--${status}${active === from || active === to ? ' evidence-graph__line--active' : ''}`}
        />
      ))}
    </svg>
  );
}

export function EvidenceGraph() {
  const [active, setActive] = useState<EvidenceId>('offer');
  const selected = evidence[active];

  return (
    <div
      className="evidence-graph"
      role="group"
      aria-label="Fictional evidence relationship demonstration"
      aria-describedby="evidence-graph-description"
    >
      <div className="evidence-graph__header">
        <span>Relationship map / sample 001</span>
        <span>Fictional demonstration · No live verification</span>
      </div>
      <p
        className="evidence-graph__description"
        id="evidence-graph-description"
      >
        The internship offer connects to a recruiter identity and a payment
        request. The recruiter and payment request connect to a personal
        communication channel. Solid coral relationships mark suspicious
        signals; dashed neutral relationships remain unverified.
      </p>
      <div
        className="evidence-graph__canvas"
        aria-describedby="evidence-graph-description"
      >
        <RelationshipLines active={active} />
        <RelationshipLines mobile active={active} />
        {order.map((id) => (
          <button
            key={id}
            type="button"
            aria-label={`${evidence[id].label}, ${evidence[id].status === 'suspicious' ? 'suspicious signal' : 'unverified information'}`}
            className={`evidence-graph__node evidence-graph__node--${id} evidence-graph__node--${evidence[id].status}${active === id ? ' evidence-graph__node--active' : ''}`}
            aria-pressed={active === id}
            aria-controls="evidence-detail"
            onClick={() => setActive(id)}
          >
            <span className="evidence-graph__node-dot" aria-hidden="true" />
            <span>{evidence[id].label}</span>
            <span className="evidence-graph__node-state">
              {evidence[id].status === 'suspicious'
                ? 'Suspicious'
                : 'Unverified'}
            </span>
          </button>
        ))}
      </div>
      <div className="evidence-graph__legend" aria-label="Relationship legend">
        <span>
          <i className="evidence-graph__legend-mark evidence-graph__legend-mark--suspicious" />
          Suspicious signal
        </span>
        <span>
          <i className="evidence-graph__legend-mark evidence-graph__legend-mark--unverified" />
          Unverified information
        </span>
      </div>
      <div
        className="evidence-graph__detail"
        id="evidence-detail"
        role="status"
        aria-live="polite"
      >
        <div>
          <span
            className={`evidence-graph__status evidence-graph__status--${selected.status}`}
          >
            {selected.status === 'suspicious'
              ? 'Suspicious signal'
              : 'Unverified information'}
          </span>
          <h3>{selected.title}</h3>
        </div>
        <div>
          <p>{selected.detail}</p>
          <p className="evidence-graph__next">
            <span>Next check / </span>
            {selected.nextCheck}
          </p>
        </div>
      </div>
    </div>
  );
}
