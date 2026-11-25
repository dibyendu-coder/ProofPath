/** Public response shape for the infrastructure health endpoint. */
export type HealthResponse = {
  status: 'ok';
};

export type SourceType = 'text' | 'url' | 'image' | 'pdf';

export type IntakeMetadata = {
  characterCount?: number;
  normalizedUrl?: string;
  fileName?: string;
  fileSize?: number;
  format?: 'png' | 'jpeg' | 'webp' | 'pdf';
  width?: number;
  height?: number;
  pageCount?: number;
  pageTitle?: string;
};

export type ProcessingStatus =
  'supplied' | 'extracted' | 'partial' | 'unavailable' | 'failed';
export type ExtractionMethod =
  | 'user_supplied'
  | 'html_text'
  | 'plain_text'
  | 'image_ocr'
  | 'pdf_text'
  | 'none';

export type SourceProvenance = {
  sourceType: SourceType;
  origin: 'user_supplied' | 'retrieved' | 'extracted' | 'not_extracted';
  extractionMethod: ExtractionMethod;
  originalUrl?: string;
  finalUrl?: string;
  retrievedAt?: string;
  extractedAt?: string;
  redirectHistory?: string[];
  pageNumbers?: number[];
};

export type IntakeSuccess = {
  status: 'prepared';
  caseId: string;
  sourceType: SourceType;
  submittedAt: string;
  extractedText?: string;
  metadata: IntakeMetadata;
  warnings: string[];
  processingStatus?: ProcessingStatus;
  extractionMethod?: ExtractionMethod;
  provenance?: SourceProvenance;
  errors?: string[];
};

export type IntakeFailure = {
  status: 'failed';
  code: string;
  message: string;
  processingStatus?: ProcessingStatus;
  warnings?: string[];
};

export type AnalysisFinding = {
  id: string;
  category: string;
  title: string;
  severity: 'low' | 'medium' | 'high';
  explanation: string;
  quotation: string;
  uncertainty: 'low' | 'medium' | 'high';
  origin: string;
  userCorrected: boolean;
  start: number;
  end: number;
};

export type AnalysisReport = {
  status: 'complete';
  analysisId: string;
  caseId: string;
  analyzedAt: string;
  model: string;
  providerMetrics: {
    latencyMs: number;
    requests: number;
    usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    } | null;
  };
  sourceType: SourceType;
  evidenceOrigin: string;
  provenanceAuthenticated: false;
  opportunityType: string;
  summary: string;
  claims: Array<{
    text: string;
    quotation: string;
    origin: string;
    userCorrected: boolean;
    start: number;
    end: number;
  }>;
  findings: AnalysisFinding[];
  rejectedEvidenceCount: number;
  missingInformation: string[];
  uncertaintyIndicators: string[];
  recommendedActions: string[];
  limitations: string[];
  risk: { score: number; classification: string; explanation: string };
};
