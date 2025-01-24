type ValidationResult = {
  isValid: boolean;
  remarks: string[];
};

export function validatePassportData(data: Record<string, any>): ValidationResult {
  const remarks: string[] = [];

  // Check passport number length (typically 8-9 characters)
  if (data.passportNumber && data.passportNumber.length > 9) {
    remarks.push(`Passport number is unusually long (${data.passportNumber.length} characters)`);
  }

  // Check for realistic date ranges
  const now = new Date();
  const minYear = 1900;

  // Date of Birth validation
  if (data.dateOfBirth) {
    const dob = new Date(data.dateOfBirth);
    if (dob > now || dob.getFullYear() < minYear) {
      remarks.push('Date of birth appears invalid');
    }
  }

  // Date of Issue validation
  if (data.dateOfIssue) {
    const doi = new Date(data.dateOfIssue);
    if (doi > now || doi.getFullYear() < minYear) {
      remarks.push('Date of issue appears invalid');
    }
  }

  // Date of Expiry validation
  if (data.dateOfExpiry) {
    const doe = new Date(data.dateOfExpiry);
    if (doe < now) {
      remarks.push('Passport appears to be expired');
    }
  }

  // Check for missing or empty required fields
  const requiredFields = [
    'fullName',
    'dateOfBirth',
    'passportNumber',
    'nationality',
    'dateOfIssue',
    'dateOfExpiry',
  ];

  const missingFields = requiredFields.filter(
    field => !data[field] || data[field].toString().trim() === ''
  );

  if (missingFields.length > 0) {
    remarks.push(`Missing required fields: ${missingFields.join(', ')}`);
  }

  return {
    isValid: remarks.length === 0,
    remarks: remarks,
  };
}
