import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import type { AnalysisReport } from '../../shared/contracts';
import { buildEvidenceGraph } from './buildEvidenceGraph';
import { filterGraph } from './filterGraph';
import { layoutGraph, type PlacedNode } from './layoutGraph';
import type { GraphFilter, GraphNode, InvestigationGraph } from './types';
import './evidence-graph.css';

const filters: Array<{ value: GraphFilter; label: string }> = [
  { value: 'all', label: 'All nodes' },
  { value: 'findings', label: 'Risk findings' },
  { value: 'evidence', label: 'Source evidence' },
  { value: 'actions', label: 'Verification actions' },
  { value: 'uncertainties', label: 'Uncertainties' },
];
const typeNames: Record<GraphNode['type'], string> = {
  OPPORTUNITY: 'Opportunity',
  CLAIM: 'Source claim',
  EVIDENCE: 'Source evidence',
  RISK_FINDING: 'Risk finding',
  UNCERTAINTY: 'Uncertainty',
  VERIFICATION_ACTION: 'Verification action',
};

function Inspector({
  node,
  graph,
  onTrace,
  onFocus,
  onClear,
}: {
  node: GraphNode | null;
  graph: InvestigationGraph;
  onTrace: (start: number, end: number) => void;
  onFocus: (id: string) => void;
  onClear: () => void;
}) {
  const finding =
    node?.type === 'RISK_FINDING'
      ? graph.report.findings.find((item) => item.id === node.findingIds[0])
      : null;
  const associated =
    node?.type === 'EVIDENCE'
      ? graph.report.findings.filter((item) =>
          node.findingIds.includes(item.id),
        )
      : [];
  return (
    <aside
      className="intelligence-graph__inspector"
      aria-label="Evidence inspector"
    >
      <div className="intelligence-graph__inspector-top">
        <span>02 / Evidence inspector</span>
        {node && (
          <button type="button" onClick={onClear}>
            Clear selection
          </button>
        )}
      </div>
      {node ? (
        <>
          <p className="intelligence-graph__node-type">
            {typeNames[node.type]}
            {node.severity ? ` / ${node.severity} severity` : ''}
          </p>
          <h4>{node.title}</h4>
          <p>{node.description}</p>
          {node.quotation && <blockquote>{node.quotation}</blockquote>}
          <dl>
            <div>
              <dt>Evidence origin</dt>
              <dd>{node.origin.replaceAll('_', ' ')}</dd>
            </div>
            <div>
              <dt>Extraction method</dt>
              <dd>{node.extractionMethod.replaceAll('_', ' ')}</dd>
            </div>
            {node.start !== undefined && node.end !== undefined && (
              <div>
                <dt>Reviewed text offsets</dt>
                <dd>
                  {node.start}–{node.end}
                </dd>
              </div>
            )}
            {node.uncertainty && (
              <div>
                <dt>Uncertainty</dt>
                <dd>{node.uncertainty}</dd>
              </div>
            )}
            {node.type === 'OPPORTUNITY' && (
              <>
                <div>
                  <dt>AI opportunity category</dt>
                  <dd>{graph.report.opportunityType.replaceAll('_', ' ')}</dd>
                </div>
                <div>
                  <dt>Source type</dt>
                  <dd>{graph.report.sourceType}</dd>
                </div>
                <div>
                  <dt>Analysis</dt>
                  <dd>{graph.report.status}</dd>
                </div>
                <div>
                  <dt>Warning-sign index</dt>
                  <dd>
                    {graph.report.risk.score} / 100 ·{' '}
                    {graph.report.risk.classification}
                  </dd>
                </div>
              </>
            )}
          </dl>
          {finding && (
            <>
              <p className="intelligence-graph__annotation">
                AI interpretation of reviewed text. The source and sender have
                not been independently verified.
              </p>
              {graph.report.uncertaintyIndicators.length > 0 && (
                <div>
                  <strong>Report uncertainty</strong>
                  <ul>
                    {graph.report.uncertaintyIndicators.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
          {associated.length > 0 && (
            <div>
              <strong>Associated findings</strong>
              <ul>
                {associated.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onFocus(`finding:${item.id}`)}
                    >
                      {item.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {node.type === 'UNCERTAINTY' && (
            <p className="intelligence-graph__annotation">
              This information was not established by the reviewed source. Use
              the independent checks listed in the report.
            </p>
          )}
          {node.type === 'VERIFICATION_ACTION' && (
            <p className="intelligence-graph__annotation">
              Recommended for the opportunity overall. The report does not
              associate this action with a particular finding.
            </p>
          )}
          {node.start !== undefined && node.end !== undefined && (
            <button
              type="button"
              className="intelligence-graph__trace"
              onClick={() => onTrace(node.start!, node.end!)}
            >
              View in source ↗
            </button>
          )}
          {node.type === 'RISK_FINDING' && (
            <button
              type="button"
              className="intelligence-graph__focus"
              onClick={() => onFocus(node.id)}
            >
              Focus on finding
            </button>
          )}
        </>
      ) : (
        <>
          <h4>Choose a connection.</h4>
          <p>
            Select a node to inspect what the reviewed text supports and what
            remains unconfirmed.
          </p>
        </>
      )}
      <p className="intelligence-graph__annotation">
        Source text is user-confirmed, not independently verified. OCR may
        contain transcription errors.
      </p>
    </aside>
  );
}

function edgePath(from: PlacedNode, to: PlacedNode) {
  const forward = from.x < to.x;
  const x1 = forward ? from.x + from.width : from.x;
  const x2 = forward ? to.x : to.x + to.width;
  const y1 = from.y + from.height / 2;
  const y2 = to.y + to.height / 2;
  const bend = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${bend} ${y1}, ${bend} ${y2}, ${x2} ${y2}`;
}

export function EvidenceGraph({
  report,
  reviewedText,
  onTrace,
  active,
}: {
  report: AnalysisReport;
  reviewedText: string;
  onTrace: (start: number, end: number) => void;
  active: boolean;
}) {
  const graph = useMemo(
    () => buildEvidenceGraph(report, reviewedText),
    [report, reviewedText],
  );
  const [filter, setFilter] = useState<GraphFilter>('all');
  const [severity, setSeverity] = useState('all');
  const [expanded, setExpanded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const viewport = useRef<HTMLDivElement>(null);
  const fittedLayout = useRef<typeof layout | null>(null);
  const drag = useRef<{
    x: number;
    y: number;
    left: number;
    top: number;
  } | null>(null);
  const filtered = useMemo(
    () => filterGraph(graph, filter, severity, expanded),
    [graph, filter, severity, expanded],
  );
  const layout = useMemo(() => layoutGraph(filtered), [filtered]);
  const selected = graph.nodes.find((node) => node.id === selectedId) ?? null;
  const connected = new Set<string>(selectedId ? [selectedId] : []);
  for (const edge of graph.edges)
    if (edge.from === selectedId || edge.to === selectedId) {
      connected.add(edge.from);
      connected.add(edge.to);
    }
  const fit = () => {
    const box = viewport.current;
    if (!box) return;
    const width = box.clientWidth || 800,
      height = box.clientHeight || 550;
    const scale = Math.max(
      0.2,
      Math.min((width - 32) / layout.width, (height - 32) / layout.height, 1),
    );
    setView({
      scale,
      x: (width - layout.width * scale) / 2,
      y: (height - layout.height * scale) / 2,
    });
  };
  const openingView = () => {
    const box = viewport.current;
    if (!box) return;
    const width = box.clientWidth || 800;
    const scale = width < 500 ? 0.7 : 0.85;
    setView({
      scale,
      x: width < 500 ? -150 : 16,
      y: 16,
    });
  };
  useEffect(() => {
    if (active && fittedLayout.current !== layout) {
      if (fittedLayout.current) fit();
      else openingView();
      fittedLayout.current = layout;
    }
  }, [layout, active]);
  const zoom = (factor: number) =>
    setView((previous) => {
      const box = viewport.current;
      const cx = (box?.clientWidth ?? 600) / 2,
        cy = (box?.clientHeight ?? 450) / 2;
      const scale = Math.max(0.35, Math.min(2, previous.scale * factor));
      return {
        scale,
        x: cx - ((cx - previous.x) / previous.scale) * scale,
        y: cy - ((cy - previous.y) / previous.scale) * scale,
      };
    });
  const focus = (id: string) => {
    setSelectedId(id);
    const node = layout.nodes.find((item) => item.id === id);
    const box = viewport.current;
    if (node && box)
      setView((previous) => ({
        ...previous,
        x: box.clientWidth / 2 - (node.x + node.width / 2) * previous.scale,
        y: box.clientHeight / 2 - (node.y + node.height / 2) * previous.scale,
      }));
  };
  const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button')) return;
    drag.current = {
      x: event.clientX,
      y: event.clientY,
      left: view.x,
      top: view.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const pointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    setView((current) => ({
      ...current,
      x: drag.current!.left + event.clientX - drag.current!.x,
      y: drag.current!.top + event.clientY - drag.current!.y,
    }));
  };
  const matchCount = useMemo(
    () =>
      filterGraph(graph, filter, severity, true).nodes.filter(
        (node) => node.type !== 'OPPORTUNITY',
      ).length,
    [graph, filter, severity],
  );

  return (
    <div
      className="intelligence-graph"
      aria-label="Investigation evidence graph"
    >
      <header className="intelligence-graph__header">
        <div>
          <span>Evidence intelligence / {report.analysisId.slice(0, 8)}</span>
          <h3>Follow the evidence.</h3>
          <p>
            Relationships come from this validated report. Lines describe
            support and uncertainty, not independent verification.
          </p>
        </div>
        <span className="intelligence-graph__count">
          {graph.nodes.length} nodes · {graph.edges.length} relationships
        </span>
      </header>
      <div className="intelligence-graph__filters" aria-label="Graph filters">
        {filters.map((item) => (
          <button
            key={item.value}
            type="button"
            aria-pressed={filter === item.value}
            onClick={() => {
              setFilter(item.value);
              setExpanded(false);
              setSelectedId(null);
            }}
          >
            {item.label}
          </button>
        ))}
        {(filter === 'findings' || filter === 'all') && (
          <label>
            Severity{' '}
            <select
              aria-label="Filter severity"
              value={severity}
              onChange={(event) => {
                setSeverity(event.target.value);
                setSelectedId(null);
              }}
            >
              <option value="all">All</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
        )}
        {(filter !== 'all' || severity !== 'all') && (
          <button
            type="button"
            onClick={() => {
              setFilter('all');
              setSeverity('all');
              setExpanded(false);
            }}
          >
            Reset filters
          </button>
        )}
      </div>
      <div className="intelligence-graph__workspace">
        <div className="intelligence-graph__map">
          <div
            className="intelligence-graph__toolbar"
            aria-label="Graph view controls"
          >
            <button
              type="button"
              onClick={() => zoom(1.2)}
              aria-label="Zoom in"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => zoom(1 / 1.2)}
              aria-label="Zoom out"
            >
              −
            </button>
            <button type="button" onClick={fit}>
              Fit to view
            </button>
            <button
              type="button"
              onClick={() => setView({ scale: 1, x: 0, y: 0 })}
            >
              Reset view
            </button>
          </div>
          {filtered.nodes.length === 0 ? (
            <div className="intelligence-graph__empty">
              <strong>No matching evidence</strong>
              <p>Try another filter. An empty graph is not a safety verdict.</p>
              <button
                type="button"
                onClick={() => {
                  setFilter('all');
                  setSeverity('all');
                }}
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div
              className="intelligence-graph__viewport"
              ref={viewport}
              onPointerDown={pointerDown}
              onPointerMove={pointerMove}
              onPointerUp={() => {
                drag.current = null;
              }}
              onPointerCancel={() => {
                drag.current = null;
              }}
              role="group"
              aria-label="Pannable graph canvas"
            >
              <div
                className="intelligence-graph__stage"
                style={{
                  width: layout.width,
                  height: layout.height,
                  transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
                }}
              >
                <svg
                  width={layout.width}
                  height={layout.height}
                  aria-hidden="true"
                  className="intelligence-graph__edges"
                >
                  {layout.edges.map((edge) => {
                    const from = layout.nodes.find(
                      (node) => node.id === edge.from,
                    )!;
                    const to = layout.nodes.find(
                      (node) => node.id === edge.to,
                    )!;
                    const active =
                      selectedId &&
                      (edge.from === selectedId || edge.to === selectedId);
                    return (
                      <path
                        key={edge.id}
                        d={edgePath(from, to)}
                        className={`${edge.type === 'SUPPORTS' ? 'is-support' : ''} ${active ? 'is-active' : ''} ${selectedId && !active ? 'is-dim' : ''}`}
                      />
                    );
                  })}
                </svg>
                {layout.nodes.map((node) => (
                  <button
                    key={node.id}
                    type="button"
                    className={`intelligence-graph__node intelligence-graph__node--${node.type.toLowerCase()} ${selectedId && !connected.has(node.id) ? 'is-dim' : ''}`}
                    style={{
                      left: node.x,
                      top: node.y,
                      width: node.width,
                      height: node.height,
                    }}
                    aria-pressed={selectedId === node.id}
                    aria-label={`${typeNames[node.type]}: ${node.title}`}
                    onClick={() => setSelectedId(node.id)}
                  >
                    <span>
                      {typeNames[node.type]}
                      {node.severity ? ` / ${node.severity}` : ''}
                    </span>
                    <strong>
                      {node.type === 'EVIDENCE'
                        ? `“${node.quotation}”`
                        : node.title}
                    </strong>
                    {node.type === 'CLAIM' && (
                      <small>Unverified source claim</small>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="intelligence-graph__map-foot">
            <span>Drag empty canvas to pan · Select a node to inspect</span>
            {matchCount > 8 && (
              <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
              >
                {expanded
                  ? 'Show fewer nodes'
                  : `Show all ${matchCount} matching nodes`}
              </button>
            )}
          </div>
        </div>
        <Inspector
          node={selected}
          graph={graph}
          onTrace={onTrace}
          onFocus={focus}
          onClear={() => setSelectedId(null)}
        />
      </div>
      <details className="intelligence-graph__alternative">
        <summary>Accessible evidence list · {graph.nodes.length} nodes</summary>
        <p>
          Each item is selectable and opens the same inspector. Quotations come
          from the confirmed source; claims remain unverified.
        </p>
        <ul>
          {graph.nodes.map((node) => (
            <li key={node.id}>
              <button type="button" onClick={() => setSelectedId(node.id)}>
                {typeNames[node.type]}: {node.title}
              </button>
              {node.quotation && <q>{node.quotation}</q>}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
