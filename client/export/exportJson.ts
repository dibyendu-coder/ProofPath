import { reportSnapshotSchema } from './types';
import type { ReportSnapshot } from './types';

export function exportJson(snapshot: ReportSnapshot) {
  const valid = reportSnapshotSchema.parse(snapshot);
  return new Blob([JSON.stringify(valid, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
}

export function reportFilename(caseId: string, extension: 'pdf' | 'json') {
  const safe = caseId.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 80) || 'case';
  return `ProofPath-Investigation-${safe}.${extension}`;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
