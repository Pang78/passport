import { z } from "zod";
import type { PassportData } from "@/pages/home";

const CONFIDENCE_THRESHOLD = 0.6;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const PASSPORT_NUMBER_REGEX = /^[A-Z0-9]{7,9}$/;

export type ValidationResult = {
  isValid: boolean;
  remarks: string[];
  qualityScore: number;
};

// Validation schema for passport data
const passportSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  dateOfBirth: z.string().regex(DATE_REGEX, "Invalid date format (YYYY-MM-DD)"),
  passportNumber: z.string().regex(PASSPORT_NUMBER_REGEX, "Invalid passport number format"),
  nationality: z.string().min(2, "Nationality must be at least 2 characters"),
  dateOfIssue: z.string().regex(DATE_REGEX, "Invalid date format (YYYY-MM-DD)"),
  dateOfExpiry: z.string().regex(DATE_REGEX, "Invalid date format (YYYY-MM-DD)"),
  placeOfBirth: z.string().min(2, "Place of birth must be at least 2 characters"),
  issuingAuthority: z.string().min(2, "Issuing authority must be at least 2 characters"),
});

export function validatePassportData(data: PassportData): ValidationResult {
  const remarks: string[] = [];
  let qualityScore = 100;

  // Validate confidence scores
  if (data.confidence_scores) {
    Object.entries(data.confidence_scores).forEach(([field, score]) => {
      if (score < CONFIDENCE_THRESHOLD) {
        remarks.push(`Low confidence (${(score * 100).toFixed(1)}%) for ${field}`);
        qualityScore -= 10;
      }
    });
  }

  // Date validations
  try {
    const now = new Date();
    const minYear = 1900;

    // Date of Birth validation
    if (data.dateOfBirth) {
      const dob = new Date(data.dateOfBirth);
      if (dob > now) {
        remarks.push('Date of birth is in the future');
        qualityScore -= 15;
      }
      if (dob.getFullYear() < minYear) {
        remarks.push('Date of birth is unrealistically old');
        qualityScore -= 15;
      }
    }

    // Date of Issue validation
    if (data.dateOfIssue) {
      const doi = new Date(data.dateOfIssue);
      if (doi > now) {
        remarks.push('Date of issue is in the future');
        qualityScore -= 15;
      }
      if (doi.getFullYear() < minYear) {
        remarks.push('Date of issue is unrealistically old');
        qualityScore -= 15;
      }
    }

    // Date of Expiry validation
    if (data.dateOfExpiry) {
      const doe = new Date(data.dateOfExpiry);
      if (doe < now) {
        remarks.push('Passport is expired');
        qualityScore -= 10;
      }
    }

    // Logical date order validation
    if (data.dateOfBirth && data.dateOfIssue) {
      const dob = new Date(data.dateOfBirth);
      const doi = new Date(data.dateOfIssue);
      if (doi < dob) {
        remarks.push('Issue date cannot be before date of birth');
        qualityScore -= 20;
      }
    }
  } catch (error) {
    remarks.push('Invalid date format detected');
    qualityScore -= 25;
  }

  // MRZ validation
  if (data.mrz) {
    if (!data.mrz.line1 || !data.mrz.line2) {
      remarks.push('Incomplete MRZ data');
      qualityScore -= 15;
    } else {
      // Basic MRZ format checks
      const mrzLine1Regex = /^[A-Z0-9<]{44}$/;
      const mrzLine2Regex = /^[A-Z0-9<]{44}$/;

      if (!mrzLine1Regex.test(data.mrz.line1)) {
        remarks.push('Invalid MRZ line 1 format');
        qualityScore -= 10;
      }
      if (!mrzLine2Regex.test(data.mrz.line2)) {
        remarks.push('Invalid MRZ line 2 format');
        qualityScore -= 10;
      }
    }
  }

  // Schema validation
  try {
    passportSchema.parse({
      fullName: data.fullName,
      dateOfBirth: data.dateOfBirth,
      passportNumber: data.passportNumber,
      nationality: data.nationality,
      dateOfIssue: data.dateOfIssue,
      dateOfExpiry: data.dateOfExpiry,
      placeOfBirth: data.placeOfBirth,
      issuingAuthority: data.issuingAuthority,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      error.errors.forEach(err => {
        remarks.push(`${err.path.join('.')}: ${err.message}`);
        qualityScore -= 10;
      });
    }
  }

  // Normalize quality score
  qualityScore = Math.max(0, Math.min(100, qualityScore));

  return {
    isValid: remarks.length === 0,
    remarks,
    qualityScore,
  };
}

export function isConfidenceAboveThreshold(data: PassportData): boolean {
  if (!data.confidence_scores) return false;

  const scores = Object.values(data.confidence_scores);
  const averageConfidence = scores.reduce((sum, score) => sum + score, 0) / scores.length;

  return averageConfidence >= CONFIDENCE_THRESHOLD;
}