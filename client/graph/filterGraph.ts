import type { GraphFilter, InvestigationGraph } from './types';

export function filterGraph(
  graph: InvestigationGraph,
  filter: GraphFilter,
  severity: string,
  expanded: boolean,
): InvestigationGraph {
  const matches = graph.nodes.filter((node) => {
    if (filter === 'all') {
      if (severity === 'all') return true;
      if (node.type === 'RISK_FINDING') return node.severity === severity;
      if (node.type !== 'EVIDENCE') return true;
      return graph.edges.some(
        (edge) =>
          edge.type === 'SUPPORTS' &&
          edge.from === node.id &&
          graph.nodes.some(
            (target) =>
              target.id === edge.to &&
              (target.type === 'CLAIM' ||
                (target.type === 'RISK_FINDING' &&
                  target.severity === severity)),
          ),
      );
    }
    if (filter === 'findings')
      return (
        node.type === 'RISK_FINDING' &&
        (severity === 'all' || node.severity === severity)
      );
    if (filter === 'evidence') return node.type === 'EVIDENCE';
    if (filter === 'actions') return node.type === 'VERIFICATION_ACTION';
    return node.type === 'UNCERTAINTY';
  });
  const limited = expanded ? matches : matches.slice(0, 8);
  const ids = new Set(limited.map((node) => node.id));
  if (limited.length) {
    const opportunity = graph.nodes.find((node) => node.type === 'OPPORTUNITY');
    if (opportunity) ids.add(opportunity.id);
  }
  if (filter === 'findings' || filter === 'all') {
    for (const edge of graph.edges)
      if (edge.type === 'SUPPORTS' && ids.has(edge.to)) ids.add(edge.from);
  }
  if (filter === 'evidence') {
    for (const edge of graph.edges)
      if (edge.type === 'SUPPORTS' && ids.has(edge.from)) ids.add(edge.to);
  }
  if (filter === 'actions') {
    for (const edge of graph.edges)
      if (edge.type === 'ADDRESSES' && ids.has(edge.from)) ids.add(edge.to);
  }
  return {
    ...graph,
    nodes: graph.nodes.filter((node) => ids.has(node.id)),
    edges: graph.edges.filter((edge) => ids.has(edge.from) && ids.has(edge.to)),
  };
}
