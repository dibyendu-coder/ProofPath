import type { ReportSnapshot } from './types';

function ordered(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(ordered);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, item]) => [key, ordered(item)]),
    );
  return value;
}

export function canonicalReportPayload(snapshot: ReportSnapshot) {
  const { fingerprint: _fingerprint, ...payload } = snapshot;
  void _fingerprint;
  return JSON.stringify(ordered(payload));
}

export async function fingerprintReport(snapshot: ReportSnapshot) {
  const bytes = new TextEncoder().encode(canonicalReportPayload(snapshot));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}
