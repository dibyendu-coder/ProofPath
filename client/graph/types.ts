import type {
  AnalysisFinding,
  AnalysisReport,
  ExtractionMethod,
} from '../../shared/contracts';

export type GraphNodeType =
  | 'OPPORTUNITY'
  | 'CLAIM'
  | 'EVIDENCE'
  | 'RISK_FINDING'
  | 'UNCERTAINTY'
  | 'VERIFICATION_ACTION';

export type RelationshipType =
  | 'CONTAINS'
  | 'SUPPORTS'
  | 'INDICATES'
  | 'REQUIRES_VERIFICATION'
  | 'REMAINS_UNCONFIRMED'
  | 'ADDRESSES';

export type GraphNode = {
  id: string;
  type: GraphNodeType;
  title: string;
  description: string;
  origin: string;
  severity?: AnalysisFinding['severity'];
  uncertainty?: AnalysisFinding['uncertainty'];
  quotation?: string;
  start?: number;
  end?: number;
  findingIds: string[];
  extractionMethod: ExtractionMethod | 'unknown';
};

export type GraphEdge = {
  id: string;
  from: string;
  to: string;
  type: RelationshipType;
};

export type InvestigationGraph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  report: AnalysisReport;
};

export type GraphFilter =
  'all' | 'findings' | 'evidence' | 'actions' | 'uncertainties';
