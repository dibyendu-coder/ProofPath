import { describe, expect, it } from 'vitest';
import { buildEvidenceGraph, sourceSpan } from './buildEvidenceGraph';
import { filterGraph } from './filterGraph';
import { layoutGraph } from './layoutGraph';
import { report, reviewedText } from './testFixture';

describe('validated report to evidence graph', () => {
  it('preserves finding IDs, exact source offsets, and provenance without changing risk', () => {
    const graph = buildEvidenceGraph(report, reviewedText);
    expect(
      graph.nodes.find((node) => node.id === 'finding:F-01')?.severity,
    ).toBe('high');
    const evidence = graph.nodes.find(
      (node) => node.type === 'EVIDENCE' && node.findingIds.length === 2,
    )!;
    expect(reviewedText.slice(evidence.start, evidence.end)).toBe(
      evidence.quotation,
    );
    expect(evidence.origin).toBe('user_supplied');
    expect(evidence.findingIds).toEqual(['F-01', 'F-02']);
    expect(graph.report.risk).toBe(report.risk);
    expect(
      graph.edges.filter(
        (edge) => edge.from === evidence.id && edge.type === 'SUPPORTS',
      ),
    ).toHaveLength(2);
    expect(graph.nodes.filter((node) => node.type === 'EVIDENCE')).toHaveLength(
      2,
    );
  });
  it('does not present the model opportunity category as a verified source label', () => {
    const graph = buildEvidenceGraph(
      { ...report, opportunityType: 'scholarship' },
      reviewedText,
    );
    expect(graph.nodes.find((node) => node.type === 'OPPORTUNITY')?.title).toBe(
      'Opportunity under review',
    );
  });
  it('is deterministic, deduplicates findings and claims, and never leaves edges dangling', () => {
    const altered = {
      ...report,
      findings: [...report.findings, report.findings[0]],
      claims: [...report.claims, report.claims[0]],
    };
    const a = buildEvidenceGraph(altered, reviewedText);
    const b = buildEvidenceGraph(altered, reviewedText);
    expect(a.nodes.map((node) => node.id)).toEqual(
      b.nodes.map((node) => node.id),
    );
    expect(new Set(a.nodes.map((node) => node.id)).size).toBe(a.nodes.length);
    expect(new Set(a.edges.map((edge) => edge.id)).size).toBe(a.edges.length);
    expect(a.nodes.filter((node) => node.type === 'RISK_FINDING')).toHaveLength(
      2,
    );
    expect(a.nodes.filter((node) => node.type === 'CLAIM')).toHaveLength(1);
    const ids = new Set(a.nodes.map((node) => node.id));
    expect(
      a.edges.every((edge) => ids.has(edge.from) && ids.has(edge.to)),
    ).toBe(true);
  });
  it('rejects missing or misplaced quotations and avoids unsupported action links', () => {
    const altered = {
      ...report,
      findings: [
        { ...report.findings[0], quotation: 'Imaginary payment' },
        report.findings[1],
      ],
    };
    const graph = buildEvidenceGraph(altered, reviewedText);
    expect(graph.nodes.some((node) => node.id === 'finding:F-01')).toBe(false);
    expect(
      graph.edges.filter((edge) => edge.type === 'ADDRESSES'),
    ).toHaveLength(0);
    expect(
      graph.edges.filter((edge) => edge.type === 'REQUIRES_VERIFICATION'),
    ).toHaveLength(1);
    expect(sourceSpan(reviewedText, 'Pay ₹1,499', 0, 10)).toBe(false);
  });
  it('traces a repeated quotation by the supplied validated offset', () => {
    const quote = report.findings[0].quotation;
    const repeated = `${quote} ${quote}`;
    const second = repeated.lastIndexOf(quote);
    const duplicate = {
      ...report,
      claims: [],
      findings: [
        { ...report.findings[0], start: second, end: second + quote.length },
      ],
    };
    const graph = buildEvidenceGraph(duplicate, repeated);
    const evidence = graph.nodes.find((node) => node.type === 'EVIDENCE')!;
    expect(evidence.start).toBe(second);
    expect(evidence.quotation).toBe(quote);
  });
  it('removes evidence that only supports excluded severities', () => {
    const graph = buildEvidenceGraph(report, reviewedText);
    const filtered = filterGraph(graph, 'all', 'high', true);
    expect(filtered.nodes.some((node) => node.id === 'finding:F-02')).toBe(
      false,
    );
    expect(filtered.edges.some((edge) => edge.to === 'finding:F-02')).toBe(
      false,
    );
    expect(filtered.report).toBe(report);
  });
  it('handles empty and inconclusive reports', () => {
    const graph = buildEvidenceGraph(
      {
        ...report,
        findings: [],
        claims: [],
        missingInformation: [],
        uncertaintyIndicators: [],
        recommendedActions: [],
        risk: { ...report.risk, classification: 'Inconclusive' },
      },
      reviewedText,
    );
    expect(graph.nodes).toHaveLength(1);
    expect(graph.edges).toHaveLength(0);
    expect(graph.nodes[0].type).toBe('OPPORTUNITY');
  });
  it('filters severity while retaining exact evidence and a connected opportunity', () => {
    const graph = buildEvidenceGraph(report, reviewedText);
    const filtered = filterGraph(graph, 'findings', 'high', true);
    expect(
      filtered.nodes
        .filter((node) => node.type === 'RISK_FINDING')
        .map((node) => node.id),
    ).toEqual(['finding:F-01']);
    expect(filtered.nodes.some((node) => node.type === 'EVIDENCE')).toBe(true);
    expect(filtered.nodes.some((node) => node.type === 'OPPORTUNITY')).toBe(
      true,
    );
    expect(filterGraph(graph, 'findings', 'low', true).nodes).toHaveLength(0);
  });
  it('places even long titles and maximum supported report size in nonoverlapping slots', () => {
    const many = {
      ...report,
      findings: Array.from({ length: 12 }, (_, i) => ({
        ...report.findings[0],
        id: `F-${i}`,
        title: 'Long title '.repeat(40),
      })),
    };
    const layout = layoutGraph(buildEvidenceGraph(many, reviewedText));
    expect(
      layout.nodes.filter((node) => node.type === 'RISK_FINDING'),
    ).toHaveLength(12);
    for (let i = 0; i < layout.nodes.length; i++)
      for (let j = i + 1; j < layout.nodes.length; j++) {
        const a = layout.nodes[i],
          b = layout.nodes[j];
        expect(
          a.x + a.width <= b.x ||
            b.x + b.width <= a.x ||
            a.y + a.height <= b.y ||
            b.y + b.height <= a.y,
        ).toBe(true);
      }
  });
});
