import { Card, CardContent } from "@/components/ui/card";
import PassportUpload from "@/components/passport-upload";
import JsonDisplay from "@/components/json-display";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
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
  const [passportDataList, setPassportDataList] = useState<PassportData[]>([]);

  const exportToCSV = () => {
    // Create CSV headers
    const headers = [
      "Full Name",
      "Date of Birth",
      "Passport Number",
      "Nationality",
      "Date of Issue",
      "Date of Expiry",
      "Place of Birth",
      "Issuing Authority",
      "MRZ Line 1",
      "MRZ Line 2",
    ].join(",");

    // Create CSV rows
    const rows = passportDataList.map((data) => [
      data.fullName,
      data.dateOfBirth,
      data.passportNumber,
      data.nationality,
      data.dateOfIssue,
      data.dateOfExpiry,
      data.placeOfBirth,
      data.issuingAuthority,
      data.mrz?.line1 || "",
      data.mrz?.line2 || "",
    ].map(value => `"${value}"`).join(","));

    // Combine headers and rows
    const csvContent = [headers, ...rows].join("\n");

    // Create and download the file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `passport_data_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <img
                src="/ica-invisible-guardians-logo-2.jpg"
                alt="ICA Logo"
                className="h-8 w-auto"
              />
              <div className="h-6 w-px bg-gray-200" />
              <h1 className="text-lg font-semibold text-gray-900">
                Passport Data Extractor
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="space-y-8">
          {/* Upload Section */}
          <Card className="border-2 shadow-sm">
            <CardContent className="p-8">
              <div className="max-w-2xl">
                <h2 className="text-2xl font-bold tracking-tight text-gray-900 mb-3">
                  Extract Passport Data
                </h2>
                <p className="text-gray-600 mb-8">
                  Upload passport images to automatically extract and structure their data using advanced AI technology. 
                  The system supports batch processing for multiple passports.
                </p>
                <PassportUpload onDataExtracted={setPassportDataList} />
              </div>
            </CardContent>
          </Card>

          {/* Results Section */}
          {passportDataList.length > 0 && (
            <Card className="border-2 shadow-sm">
              <CardContent className="p-8">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">
                    Extracted Data ({passportDataList.length} passport{passportDataList.length !== 1 ? "s" : ""})
                  </h2>
                  <Button onClick={exportToCSV} variant="outline" className="gap-2">
                    <Download className="w-4 h-4" />
                    Export CSV
                  </Button>
                </div>
                <div className="space-y-10">
                  {passportDataList.map((data, index) => (
                    <div 
                      key={index} 
                      className="border-t pt-8 first:border-t-0 first:pt-0"
                    >
                      <h3 className="text-lg font-semibold text-gray-900 mb-6">
                        Passport {index + 1}
                      </h3>
                      <JsonDisplay data={data} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}