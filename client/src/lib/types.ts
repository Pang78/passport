export interface ImageQualityMetrics {
  brightness: number;
  contrast: number;
  sharpness: number;
  hasGlare: boolean;
  orientation: number;
  needsRotation: boolean;
}

export interface PassportData {
  fullName: string | { value: string };
  dateOfBirth: string | { value: string };
  passportNumber: string | { value: string };
  idNumber: string | { value: string };
  nationality: string | { value: string };
  dateOfIssue: string | { value: string };
  dateOfExpiry: string | { value: string };
  placeOfBirth: string | { value: string };
  issuingAuthority: string | { value: string };
  mrz?: {
    line1: string;
    line2: string;
  };
  remarks?: string[];
  isValid?: boolean;
  validation_errors?: string[];
  confidence_scores?: {
    fullName: number;
    dateOfBirth: number;
    passportNumber: number;
    nationality: number;
    dateOfIssue: number;
    dateOfExpiry: number;
    placeOfBirth: number;
    issuingAuthority: number;
    mrz: number;
  };
  overall_confidence?: number;
  extraction_notes?: string[];
  passportPhoto?: string;
}

export interface PreviewFile {
  file: File;
  preview: string;
  name: string;
  quality?: ImageQualityMetrics;
}