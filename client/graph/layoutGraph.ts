import type { GraphNode, InvestigationGraph } from './types';

export type PlacedNode = GraphNode & {
  x: number;
  y: number;
  width: number;
  height: number;
};
export type GraphLayout = {
  nodes: PlacedNode[];
  edges: InvestigationGraph['edges'];
  width: number;
  height: number;
};

/** Fixed lanes and row slots keep positions reproducible and prevent node overlap. */
export function layoutGraph(graph: InvestigationGraph): GraphLayout {
  const grouped = graph.nodes.filter((node) => node.type !== 'OPPORTUNITY');
  const central = grouped.filter((node) =>
    ['RISK_FINDING', 'CLAIM', 'UNCERTAINTY'].includes(node.type),
  );
  const right = grouped.filter((node) =>
    ['EVIDENCE', 'VERIFICATION_ACTION'].includes(node.type),
  );
  const rowHeight = 148;
  const rows = Math.max(central.length, right.length, 1);
  const height = Math.max(420, rows * rowHeight + 100);
  const placed: PlacedNode[] = graph.nodes.map((node) => {
    const column =
      node.type === 'OPPORTUNITY' ? 0 : central.includes(node) ? 1 : 2;
    const index = column === 1 ? central.indexOf(node) : right.indexOf(node);
    return {
      ...node,
      x: [48, 400, 752][column],
      y: column === 0 ? height / 2 - 54 : 48 + index * rowHeight,
      width: column === 2 ? 280 : 260,
      height: 108,
    };
  });
  return { nodes: placed, edges: graph.edges, width: 1080, height };
}
