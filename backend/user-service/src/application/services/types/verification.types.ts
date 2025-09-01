export enum VerificationState {
  SUBMITTED = 'submitted',
  AUTO_CHECKING = 'auto_checking',
  MANUAL_REVIEW = 'manual_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  ADDITIONAL_DOCS_REQUIRED = 'additional_docs_required',
}

export interface VerificationDocument {
  type: 'passport' | 'inn_certificate' | 'ogrn_certificate';
  filePath: string;
  uploadedAt: Date;
}

export interface AutoCheckResult {
  isValid: boolean;
  confidence: number;
  reason: string;
}
