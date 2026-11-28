import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFPage,
  type PDFFont,
} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { ReportSnapshot } from './types';
import { reportSnapshotSchema } from './types';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const graphite = rgb(0.16, 0.18, 0.18);
const muted = rgb(0.41, 0.43, 0.43);
const coral = rgb(0.72, 0.32, 0.29);
const line = rgb(0.76, 0.76, 0.73);

function linesFor(text: string, font: PDFFont, size: number, width: number) {
  const result: string[] = [];
  for (const paragraph of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (!paragraph.trim()) {
      result.push('');
      continue;
    }
    let current = '';
    for (const word of paragraph.split(/\s+/)) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) {
        current = candidate;
        continue;
      }
      if (current) {
        result.push(current);
        current = '';
      }
      if (font.widthOfTextAtSize(word, size) <= width) {
        current = word;
        continue;
      }
      for (const char of Array.from(word)) {
        if (current && font.widthOfTextAtSize(current + char, size) > width) {
          result.push(current);
          current = '';
        }
        current += char;
      }
    }
    if (current) result.push(current);
  }
  return result;
}

export async function exportPdf(
  snapshot: ReportSnapshot,
  suppliedFont?: Uint8Array,
): Promise<Uint8Array> {
  const report = reportSnapshotSchema.parse(snapshot);
  const fontBytes =
    suppliedFont ??
    new Uint8Array(
      await (
        await fetch(new URL('./assets/NotoSans-Regular.ttf', import.meta.url))
      ).arrayBuffer(),
    );
  const fontFace = fontkit.create(fontBytes);
  const allText = JSON.stringify(report);
  for (const character of Array.from(allText)) {
    const code = character.codePointAt(0)!;
    if (code > 31 && !fontFace.hasGlyphForCodePoint(code))
      throw new Error(
        'The PDF font cannot represent a character in this report. Use JSON export for this report.',
      );
  }
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const body = await document.embedFont(fontBytes, { subset: false });
  const display = await document.embedFont(StandardFonts.TimesRoman);
  document.setTitle('ProofPath Investigation');
  document.setAuthor('ProofPath');
  document.setSubject('Opportunity investigation report');
  document.setCreator('ProofPath');
  if (report.fingerprint)
    document.setKeywords(['ProofPath', `SHA-256 ${report.fingerprint}`]);
  let page!: PDFPage;
  let y = 0;
  const newPage = () => {
    if (document.getPageCount() >= 60)
      throw new Error(
        'This report exceeds the 60-page export limit. Remove optional sections and try again.',
      );
    page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    page.drawRectangle({
      x: 0,
      y: PAGE_HEIGHT - 12,
      width: PAGE_WIDTH,
      height: 12,
      color: graphite,
    });
    page.drawText('PROOFPATH / INVESTIGATION FILE', {
      x: MARGIN,
      y: PAGE_HEIGHT - 40,
      size: 8,
      font: body,
      color: coral,
    });
    page.drawLine({
      start: { x: MARGIN, y: PAGE_HEIGHT - 49 },
      end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - 49 },
      thickness: 0.6,
      color: line,
    });
    y = PAGE_HEIGHT - 74;
  };
  const ensure = (height: number) => {
    if (y - height < 66) newPage();
  };
  const drawLines = (
    text: string,
    options: {
      size?: number;
      leading?: number;
      color?: ReturnType<typeof rgb>;
      indent?: number;
      gap?: number;
    } = {},
  ) => {
    const size = options.size ?? 9.5,
      leading = options.leading ?? 14,
      indent = options.indent ?? 0;
    for (const row of linesFor(text, body, size, CONTENT_WIDTH - indent)) {
      ensure(leading);
      if (row)
        page.drawText(row, {
          x: MARGIN + indent,
          y,
          size,
          font: body,
          color: options.color ?? graphite,
        });
      y -= leading;
    }
    y -= options.gap ?? 7;
  };
  const section = (number: string, title: string) => {
    ensure(58);
    y -= 15;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 0.55,
      color: line,
    });
    y -= 21;
    page.drawText(`${number} / ${title.toUpperCase()}`, {
      x: MARGIN,
      y,
      size: 10,
      font: body,
      color: coral,
    });
    y -= 22;
  };
  const label = (text: string) =>
    drawLines(text, { size: 8, leading: 12, color: muted, gap: 3 });
  const diagramBox = (x: number, title: string, subtitle: string) => {
    page.drawRectangle({
      x,
      y: y - 45,
      width: 145,
      height: 45,
      borderWidth: 0.7,
      borderColor: line,
      color: rgb(0.97, 0.96, 0.94),
    });
    page.drawText(title, {
      x: x + 8,
      y: y - 15,
      size: 7,
      font: body,
      color: coral,
    });
    const rows = linesFor(subtitle, body, 7.5, 129);
    for (let i = 0; i < Math.min(rows.length, 2); i++)
      page.drawText(rows[i], {
        x: x + 8,
        y: y - 29 - i * 10,
        size: 7.5,
        font: body,
        color: graphite,
      });
  };
  newPage();
  page!.drawText('The investigation', {
    x: MARGIN,
    y,
    size: 31,
    font: display,
    color: graphite,
  });
  y -= 40;
  drawLines('Before you trust an opportunity, verify it.', {
    size: 11,
    color: muted,
    gap: 17,
  });
  label(`Report ${report.reportId}  /  Case ${report.caseId}`);
  label(`Exported ${report.exportedAt}  /  Source ${report.sourceType}`);
  section('01', 'Executive summary');
  drawLines(report.summary, { size: 11, leading: 17 });
  drawLines(
    `Warning-sign index: ${report.risk.score} / 100  |  ${report.risk.classification}`,
    { size: 12, color: coral },
  );
  drawLines(report.risk.explanation);
  drawLines(
    'The index is a heuristic, not a calibrated fraud probability. No organization has been independently verified.',
    { size: 8.5, color: muted },
  );
  section('02', 'Investigation findings');
  if (!report.findings.length)
    drawLines(
      'No supported warning signs were retained. This is not a safety verdict.',
    );
  for (const finding of report.findings) {
    ensure(72);
    drawLines(
      `${finding.id} / ${finding.title}  |  ${finding.severity.toUpperCase()} SEVERITY`,
      { size: 11, color: coral, gap: 3 },
    );
    drawLines(finding.explanation);
    if (finding.quotation) {
      label(
        `${finding.evidenceId} / ${finding.quotationRedacted ? 'REDACTED QUOTATION' : 'SOURCE QUOTATION'} / ${finding.origin}`,
      );
      drawLines(`“${finding.quotation}”`, { indent: 12, size: 9.5 });
    }
  }
  section('03', 'Evidence register');
  if (!report.evidence.length)
    drawLines('Evidence quotations excluded by export settings.');
  for (const item of report.evidence) {
    ensure(48);
    label(
      `${item.id} / Finding ${item.findingIds.join(', ')} / ${item.origin}${item.start !== null ? ` / Offset ${item.start}-${item.end}` : ''}`,
    );
    drawLines(
      `${item.quotationRedacted ? '[Redacted quotation] ' : ''}${item.quotation}`,
    );
  }
  label(`Extraction method: ${report.extractionMethod}`);
  if (report.sourceUrl)
    drawLines(`Source URL: ${report.sourceUrl}`, { size: 8.5 });
  for (const warning of report.ocrWarnings)
    drawLines(`OCR warning: ${warning}`, { size: 8.5, color: coral });
  if (report.reviewedSource) {
    section('04', 'Reviewed source text');
    drawLines(report.reviewedSource, { size: 9 });
  }
  if (report.graph) {
    section('05', 'Evidence relationship map');
    drawLines(
      'Supported evidence, findings, and checks. The structured register below gives full relationship labels.',
      { size: 8.5, color: muted },
    );
    const nodes = new Map(report.graph.nodes.map((node) => [node.id, node]));
    for (const finding of report.findings) {
      const findingId = `finding:${finding.id}`;
      const evidence = report.graph.edges.find(
        (edge) => edge.type === 'SUPPORTS' && edge.to === findingId,
      );
      const related = report.graph.edges.filter(
        (edge) => edge.type === 'ADDRESSES' && edge.to === findingId,
      );
      if (!evidence) continue;
      for (const action of related.length ? related : [null]) {
        ensure(65);
        diagramBox(
          MARGIN,
          `EVIDENCE ${finding.evidenceId}`,
          finding.quotationRedacted
            ? 'Redacted source quote'
            : 'Reviewed source quote',
        );
        diagramBox(MARGIN + 177, `FINDING ${finding.id}`, finding.title);
        page.drawLine({
          start: { x: MARGIN + 145, y: y - 23 },
          end: { x: MARGIN + 177, y: y - 23 },
          thickness: 1,
          color: coral,
        });
        if (action) {
          diagramBox(
            MARGIN + 354,
            'VERIFICATION ACTION',
            nodes.get(action.from)?.title ?? 'Independent check',
          );
          page.drawLine({
            start: { x: MARGIN + 322, y: y - 23 },
            end: { x: MARGIN + 354, y: y - 23 },
            thickness: 1,
            color: coral,
          });
        }
        y -= 60;
      }
    }
    for (const edge of report.graph.edges) {
      const from = nodes.get(edge.from),
        to = nodes.get(edge.to);
      if (!from || !to) continue;
      drawLines(
        `${from.type.replaceAll('_', ' ')}: ${from.title}  /  ${edge.type.replaceAll('_', ' ')}  /  ${to.type.replaceAll('_', ' ')}: ${to.title}`,
        { size: 8.5, leading: 12, indent: 9, gap: 3 },
      );
    }
  }
  section('06', 'Verification plan');
  drawLines(
    `${report.verification.completed} of ${report.verification.total} user-marked actions complete; ${report.verification.unresolvedHigh} high-priority concerns unresolved.`,
    { size: 10 },
  );
  for (const action of report.verification.actions) {
    ensure(54);
    drawLines(
      `${action.priority.toUpperCase()} / ${action.title} / ${action.status.replaceAll('_', ' ')}`,
      { size: 10, color: coral, gap: 3 },
    );
    drawLines(action.method);
    if (action.findingIds.length)
      label(`Related findings: ${action.findingIds.join(', ')}`);
    for (const note of action.notes ?? []) {
      label(`${note.kind} / ${note.recordedAt} / user reported`);
      drawLines(note.text);
      if (note.referenceUrl)
        drawLines(`Reference: ${note.referenceUrl}`, { size: 8 });
    }
  }
  if (report.verification.timeline) {
    section('07', 'Investigation timeline');
    for (const event of report.verification.timeline)
      drawLines(
        `${event.at} / ${event.kind.replaceAll('_', ' ')} / ${event.label}`,
        { size: 8.5 },
      );
  }
  section('08', 'Investigation limitations');
  for (const [title, items] of [
    ['Missing information', report.missingInformation],
    ['Uncertainty', report.uncertaintyIndicators],
    ['Report limitations', report.limitations],
    ['Recommended checks', report.recommendedActions],
  ] as const) {
    if (!items.length) continue;
    label(title);
    for (const item of items) drawLines(`• ${item}`, { indent: 10 });
  }
  ensure(190);
  section('09', 'Report metadata');
  drawLines(`Analysis ${report.analyzedAt} / Export ${report.exportedAt}`);
  drawLines(`Model ${report.model} / Schema ${report.schemaVersion}`);
  if (report.fingerprint) {
    label('SHA-256 payload fingerprint (not a signature)');
    drawLines(report.fingerprint, { size: 8 });
  }
  section('10', 'Disclaimer');
  drawLines(report.disclaimer, { size: 8.5, leading: 13 });
  const pages = document.getPages();
  for (let i = 0; i < pages.length; i++) {
    const current = pages[i];
    current.drawLine({
      start: { x: MARGIN, y: 52 },
      end: { x: PAGE_WIDTH - MARGIN, y: 52 },
      thickness: 0.6,
      color: line,
    });
    current.drawText(`PROOFPATH  /  ${i + 1} OF ${pages.length}`, {
      x: MARGIN,
      y: 36,
      size: 8,
      font: body,
      color: muted,
    });
    current.drawText('Not an authenticity certificate', {
      x: PAGE_WIDTH - MARGIN - 170,
      y: 36,
      size: 8,
      font: body,
      color: muted,
    });
  }
  return document.save({ useObjectStreams: true });
}
