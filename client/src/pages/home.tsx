import { Card, CardContent } from "@/components/ui/card";
import PassportUpload from "@/components/passport-upload";
import JsonDisplay from "@/components/json-display";
import { useState } from "react";

export type PassportData = {
  fullName: string;
  dateOfBirth: string;
  passportNumber: string;
  nationality: string;
  dateOfIssue: string;
  dateOfExpiry: string;
  placeOfBirth: string;
  issuingAuthority: string;
  mrz?: {
    line1: string;
    line2: string;
  };
};

export default function Home() {
  const [passportData, setPassportData] = useState<PassportData | null>(null);

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="border-2">
          <CardContent className="p-6">
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent mb-6">
              Passport Data Extractor
            </h1>
            <p className="text-gray-600 mb-8">
              Upload a passport image to extract and structure its data using AI.
            </p>
            
            <PassportUpload onDataExtracted={setPassportData} />
          </CardContent>
        </Card>

        {passportData && (
          <Card className="border-2">
            <CardContent className="p-6">
              <h2 className="text-2xl font-semibold mb-4">Extracted Data</h2>
              <JsonDisplay data={passportData} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
