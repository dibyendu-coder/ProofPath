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
