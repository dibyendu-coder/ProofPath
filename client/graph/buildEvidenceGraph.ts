import type { AnalysisReport } from '../../shared/contracts';
import type {
  GraphEdge,
  GraphNode,
  InvestigationGraph,
  RelationshipType,
} from './types';

/** A report has already passed the server's evidence validator. Recheck offsets here
 * so a malformed transport object cannot turn an unrelated span into graph evidence. */
export function sourceSpan(
  text: string,
  quote: string,
  start: number,
  end: number,
) {
  return (
    Number.isInteger(start) &&
    Number.isInteger(end) &&
    start >= 0 &&
    end > start &&
    end <= text.length &&
    text.slice(start, end) === quote
  );
}

export function buildEvidenceGraph(
  report: AnalysisReport,
  reviewedText: string,
): InvestigationGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const edgeIds = new Set<string>();
  const nodeIds = new Set<string>();
  const method = report.evidenceOrigin as GraphNode['extractionMethod'];
  const addNode = (node: GraphNode) => {
    if (nodeIds.has(node.id)) return false;
    nodeIds.add(node.id);
    nodes.push(node);
    return true;
  };
  const addEdge = (from: string, to: string, type: RelationshipType) => {
    if (!nodeIds.has(from) || !nodeIds.has(to)) return;
    const id = `${type}:${from}:${to}`;
    if (edgeIds.has(id)) return;
    edgeIds.add(id);
    edges.push({ id, from, to, type });
  };
  const opportunityId = `opportunity:${report.analysisId}`;
  addNode({
    id: opportunityId,
    type: 'OPPORTUNITY',
    title: 'Opportunity under review',
    description: report.summary,
    origin: report.evidenceOrigin,
    findingIds: [],
    extractionMethod: method,
  });
  const evidenceBySpan = new Map<string, string>();
  const addEvidence = (
    quotation: string,
    start: number,
    end: number,
    origin: string,
    findingId?: string,
  ) => {
    if (!sourceSpan(reviewedText, quotation, start, end)) return null;
    const key = `${start}:${end}:${origin}`;
    let id = evidenceBySpan.get(key);
    if (!id) {
      id = `evidence:${start}:${end}:${encodeURIComponent(origin)}`;
      evidenceBySpan.set(key, id);
      addNode({
        id,
        type: 'EVIDENCE',
        title: 'Source quotation',
        description: quotation,
        quotation,
        start,
        end,
        origin,
        findingIds: [],
        extractionMethod: method,
      });
    }
    if (findingId) {
      const node = nodes.find((item) => item.id === id)!;
      if (!node.findingIds.includes(findingId)) node.findingIds.push(findingId);
    }
    return id;
  };

  const seenFindings = new Set<string>();
  for (const finding of report.findings) {
    if (seenFindings.has(finding.id)) continue;
    seenFindings.add(finding.id);
    const evidenceId = addEvidence(
      finding.quotation,
      finding.start,
      finding.end,
      finding.origin,
      finding.id,
    );
    if (!evidenceId) continue;
    const id = `finding:${finding.id}`;
    if (
      !addNode({
        id,
        type: 'RISK_FINDING',
        title: finding.title,
        description: finding.explanation,
        quotation: finding.quotation,
        start: finding.start,
        end: finding.end,
        origin: finding.origin,
        severity: finding.severity,
        uncertainty: finding.uncertainty,
        findingIds: [finding.id],
        extractionMethod: method,
      })
    )
      continue;
    addEdge(id, opportunityId, 'INDICATES');
    addEdge(evidenceId, id, 'SUPPORTS');
  }
  const seenClaims = new Set<string>();
  for (const claim of report.claims) {
    const key = `${claim.start}:${claim.end}:${claim.origin}`;
    if (seenClaims.has(key)) continue;
    seenClaims.add(key);
    const evidenceId = addEvidence(
      claim.quotation,
      claim.start,
      claim.end,
      claim.origin,
    );
    if (!evidenceId) continue;
    const id = `claim:${claim.start}:${claim.end}:${encodeURIComponent(claim.origin)}`;
    addNode({
      id,
      type: 'CLAIM',
      title: claim.text,
      description:
        'Observed in the reviewed source; not independently verified.',
      quotation: claim.quotation,
      start: claim.start,
      end: claim.end,
      origin: claim.origin,
      findingIds: [],
      extractionMethod: method,
    });
    addEdge(id, opportunityId, 'REMAINS_UNCONFIRMED');
    addEdge(evidenceId, id, 'SUPPORTS');
  }
  const seenUncertainty = new Set<string>();
  for (const [kind, entries] of [
    ['Missing information', report.missingInformation],
    ['Uncertainty indicator', report.uncertaintyIndicators],
  ] as const) {
    for (const entry of entries) {
      const key = `${kind}:${entry.trim().toLowerCase()}`;
      if (!entry.trim() || seenUncertainty.has(key)) continue;
      seenUncertainty.add(key);
      const id = `uncertainty:${encodeURIComponent(key)}`;
      addNode({
        id,
        type: 'UNCERTAINTY',
        title: kind,
        description: entry,
        origin: report.evidenceOrigin,
        findingIds: [],
        extractionMethod: method,
      });
      addEdge(id, opportunityId, 'REMAINS_UNCONFIRMED');
    }
  }
  const seenActions = new Set<string>();
  for (const action of report.recommendedActions) {
    const key = action.trim().toLowerCase();
    if (!key || seenActions.has(key)) continue;
    seenActions.add(key);
    const id = `action:${encodeURIComponent(key)}`;
    addNode({
      id,
      type: 'VERIFICATION_ACTION',
      title: 'Independent check',
      description: action,
      origin: 'report_recommendation',
      findingIds: [],
      extractionMethod: method,
    });
    // The API supplies no action-to-finding association. Do not invent one.
    addEdge(opportunityId, id, 'REQUIRES_VERIFICATION');
  }
  return { nodes, edges, report };
}
