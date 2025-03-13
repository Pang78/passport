export interface PassportData {
  fullName: string | { value: string };
  dateOfBirth: string | { value: string };
  passportNumber: string | { value: string };
  idNumber?: string | { value: string };
  nationality: string | { value: string };
  dateOfIssue: string | { value: string };
  dateOfExpiry: string | { value: string };
  placeOfBirth: string | { value: string };
  issuingAuthority: string | { value: string };
  gender?: string | { value: string };
  sex?: string;
  mrz?: {
    line1: string;
    line2: string;
  };
  remarks?: string[];
  isValid?: boolean;
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
    gender?: number;
  };
  overall_confidence?: number;
  extraction_notes?: string[];
  passportPhoto?: string;
  immigrationClearance?: {
    mot: string;
    checkpoint: string;
    arrivalDepartureDate: string;
    arrivalDepartureTime: string;
    tvGroup: string;
    clearanceMode: string;
    clearanceSource: string;
    userId: string;
    hostname: string;
  };
  imageUrl?: string;
}

export interface ImageQualityMetrics {
  brightness: number;
  contrast: number;
  sharpness: number;
  hasGlare: boolean;
  orientation: number;
  needsRotation: boolean;
}

export interface PreviewFile extends File {
  preview?: string;
  quality?: ImageQualityMetrics;
}