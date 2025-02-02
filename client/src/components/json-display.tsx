import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { type PassportData } from "@/lib/types";

interface JsonDisplayProps {
  data: PassportData;
  onPurgeImage?: (index: number) => void;
  onDeleteEntry?: (index: number) => void;
}

export default function JsonDisplay({ 
  data, 
  onPurgeImage,
  onDeleteEntry 
}: JsonDisplayProps) {
  const [showDetails, setShowDetails] = useState(false);

  // Helper function to get confidence class
  const getConfidenceClass = (confidence: number | undefined) => {
    if (confidence === undefined) return 'text-gray-600';
    return confidence < 0.5 
      ? 'text-red-600' 
      : confidence < 0.8 
        ? 'text-yellow-600' 
        : 'text-green-600';
  };

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <CardContent className="p-6">
          <div className="flex justify-between items-start gap-4">
            <div className="flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium text-sm text-gray-500">Full Name</h3>
                  <p className="mt-1">
                    {typeof data.fullName === 'object' ? data.fullName.value : data.fullName}
                  </p>
                </div>
                <div>
                  <h3 className="font-medium text-sm text-gray-500">Passport Number</h3>
                  <p className="mt-1">
                    {typeof data.passportNumber === 'object' ? data.passportNumber.value : data.passportNumber}
                  </p>
                </div>
              </div>

              {/* Validation Status */}
              <div className="mt-4">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    data.isValid 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {data.isValid ? 'Valid' : 'Invalid'}
                  </span>
                  <span className={getConfidenceClass(data.overall_confidence)}>
                    Confidence: {data.overall_confidence !== undefined
                      ? `${(data.overall_confidence * 100).toFixed(1)}%`
                      : 'N/A'}
                  </span>
                </div>
              </div>

              {/* Validation Errors */}
              {(!data.isValid && data.validation_errors?.length > 0) && (
                <Alert variant="destructive" className="mt-4">
                  <AlertTitle>Validation Errors</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc pl-4 space-y-1">
                      {data.validation_errors.map((error, index) => (
                        <li key={index} className="text-sm">{error}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Extraction Notes */}
              {data.extraction_notes && data.extraction_notes.length > 0 && (
                <Alert className="mt-4">
                  <AlertTitle>Notes</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc pl-4 space-y-1">
                      {data.extraction_notes.map((note, index) => (
                        <li key={index} className="text-sm">{note}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Image Preview */}
            {data.passportPhoto && (
              <div className="w-32 flex flex-col items-center gap-2">
                <div className="relative group">
                  <img
                    src={data.passportPhoto}
                    alt="Passport"
                    className="w-32 h-32 object-cover rounded-lg border border-gray-200"
                  />
                  {onPurgeImage && (
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => onPurgeImage(0)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {onDeleteEntry && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteEntry(0)}
                    className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    Delete Entry
                  </Button>
                )}
              </div>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDetails(!showDetails)}
            className="mt-4"
          >
            {showDetails ? 'Hide' : 'Show'} Details
          </Button>

          {showDetails && (
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-medium text-sm text-gray-500">Date of Birth</h3>
                <p className="mt-1">
                  {typeof data.dateOfBirth === 'object' ? data.dateOfBirth.value : data.dateOfBirth}
                </p>
              </div>
              <div>
                <h3 className="font-medium text-sm text-gray-500">Nationality</h3>
                <p className="mt-1">
                  {typeof data.nationality === 'object' ? data.nationality.value : data.nationality}
                </p>
              </div>
              <div>
                <h3 className="font-medium text-sm text-gray-500">Date of Issue</h3>
                <p className="mt-1">
                  {typeof data.dateOfIssue === 'object' ? data.dateOfIssue.value : data.dateOfIssue}
                </p>
              </div>
              <div>
                <h3 className="font-medium text-sm text-gray-500">Date of Expiry</h3>
                <p className="mt-1">
                  {typeof data.dateOfExpiry === 'object' ? data.dateOfExpiry.value : data.dateOfExpiry}
                </p>
              </div>
              {data.mrz && (
                <>
                  <div>
                    <h3 className="font-medium text-sm text-gray-500">MRZ Line 1</h3>
                    <p className="mt-1 font-mono text-xs">{data.mrz.line1}</p>
                  </div>
                  <div>
                    <h3 className="font-medium text-sm text-gray-500">MRZ Line 2</h3>
                    <p className="mt-1 font-mono text-xs">{data.mrz.line2}</p>
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}