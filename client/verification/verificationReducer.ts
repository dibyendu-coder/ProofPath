import type {
  EvidenceNote,
  TimelineEvent,
  VerificationAction,
  VerificationPlan,
  VerificationState,
  VerificationStatus,
} from './types';

export type VerificationCommand =
  | {
      type: 'start' | 'complete' | 'reopen' | 'unresolved';
      actionId: string;
      at: string;
    }
  | {
      type: 'record';
      actionId: string;
      at: string;
      kind: 'note' | 'response';
      text: string;
      referenceUrl: string;
      outcome: EvidenceNote['outcome'];
    };

export function initializeVerification(
  plan: VerificationPlan,
  at: string,
): VerificationState {
  return {
    caseId: plan.caseId,
    analysisId: plan.analysisId,
    actions: plan.actions.map((action) => ({
      ...action,
      notes: [],
      status: 'not_started',
    })),
    timeline: [
      {
        id: 1,
        at,
        kind: 'initialized',
        label: 'Verification plan initialized in this browser.',
      },
    ],
    nextEventId: 2,
    nextNoteId: 1,
  };
}

function append(
  state: VerificationState,
  event: Omit<TimelineEvent, 'id'>,
  actions: VerificationAction[],
): VerificationState {
  return {
    ...state,
    actions,
    timeline: [...state.timeline, { ...event, id: state.nextEventId }].slice(
      -100,
    ),
    nextEventId: state.nextEventId + 1,
  };
}

export function verificationReducer(
  state: VerificationState,
  command: VerificationCommand,
): VerificationState {
  const action = state.actions.find((item) => item.id === command.actionId);
  if (!action || !Number.isFinite(Date.parse(command.at))) return state;
  const update = (status: VerificationStatus, notes = action.notes) =>
    state.actions.map((item) =>
      item.id === action.id ? { ...item, status, notes } : item,
    );
  if (command.type === 'record') {
    const text = command.text.trim(),
      referenceUrl = command.referenceUrl.trim();
    if (!text || text.length > 1000 || referenceUrl.length > 500) return state;
    if (referenceUrl) {
      try {
        const parsed = new URL(referenceUrl);
        if (!['http:', 'https:'].includes(parsed.protocol)) return state;
      } catch {
        return state;
      }
    }
    const note: EvidenceNote = {
      id: `note:${state.nextNoteId}`,
      actionId: action.id,
      kind: command.kind,
      text,
      referenceUrl,
      outcome: command.outcome,
      recordedAt: command.at,
    };
    const notes = [...action.notes, note].slice(-30);
    if (command.kind === 'note')
      return {
        ...state,
        nextNoteId: state.nextNoteId + 1,
        actions: update(action.status, notes),
      };
    return {
      ...append(
        state,
        {
          at: command.at,
          kind: 'response_recorded',
          actionId: action.id,
          label: `Response recorded for ${action.title}.`,
        },
        update('response_recorded', notes),
      ),
      nextNoteId: state.nextNoteId + 1,
    };
  }
  const transitions: Record<
    Exclude<VerificationCommand['type'], 'record'>,
    { status: VerificationStatus; kind: TimelineEvent['kind']; label: string }
  > = {
    start: {
      status: 'in_progress',
      kind: 'started',
      label: `Started ${action.title}.`,
    },
    complete: {
      status: 'complete',
      kind: 'completed',
      label: `User marked ${action.title} complete.`,
    },
    reopen: {
      status: 'in_progress',
      kind: 'reopened',
      label: `Reopened ${action.title}.`,
    },
    unresolved: {
      status: 'concern_unresolved',
      kind: 'unresolved',
      label: `User marked ${action.title} unresolved.`,
    },
  };
  const next = transitions[command.type];
  if (action.status === next.status) return state;
  if (command.type === 'start' && action.status !== 'not_started') return state;
  if (
    command.type === 'reopen' &&
    !['complete', 'concern_unresolved'].includes(action.status)
  )
    return state;
  if (command.type === 'complete' && action.status === 'not_started')
    return state;
  return append(
    state,
    { at: command.at, kind: next.kind, actionId: action.id, label: next.label },
    update(next.status),
  );
}

export function verificationProgress(actions: VerificationAction[]) {
  const completed = actions.filter(
    (action) => action.status === 'complete',
  ).length;
  return {
    total: actions.length,
    started: actions.filter((action) => action.status !== 'not_started').length,
    completed,
    remaining: actions.length - completed,
    unresolvedHigh: actions.filter(
      (action) =>
        action.priority === 'high' && action.status === 'concern_unresolved',
    ).length,
  };
}
