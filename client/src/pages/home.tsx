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
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="border-2">
          <CardContent className="p-6">
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent mb-6">
              Passport Data Extractor
            </h1>
            <p className="text-gray-600 mb-8">
              Upload passport images to extract and structure their data using AI.
            </p>

            <PassportUpload onDataExtracted={setPassportDataList} />
          </CardContent>
        </Card>

        {passportDataList.length > 0 && (
          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-semibold">
                  Extracted Data ({passportDataList.length} passport{passportDataList.length !== 1 ? "s" : ""})
                </h2>
                <Button onClick={exportToCSV} className="gap-2">
                  <Download className="w-4 h-4" />
                  Export CSV
                </Button>
              </div>
              <div className="space-y-8">
                {passportDataList.map((data, index) => (
                  <div key={index} className="border-t pt-6 first:border-t-0 first:pt-0">
                    <h3 className="text-lg font-medium mb-4">Passport {index + 1}</h3>
                    <JsonDisplay data={data} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}