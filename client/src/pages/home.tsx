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
    <div className="min-h-screen bg-gradient-to-b from-background to-gray-50">
      {/* Header */}
      <header className="bg-primary/95 text-primary-foreground shadow-md backdrop-blur-sm sticky top-0 z-10">
        <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            <div className="flex items-center gap-2 sm:gap-3">
              <img
                src="ica-invisible-guardians-logo-2.jpg"
                alt="ICA Logo"
                className="h-8 sm:h-12 w-auto object-contain bg-white p-1.5 rounded-lg shadow-sm transition-transform hover:scale-105"
              />
              <div className="h-6 w-px bg-primary-foreground/20" />
              <h1 className="text-base sm:text-xl font-bold tracking-tight">
                Passport Data Extractor
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* Logo */}
      <div className="flex justify-center mb-8">
        <img 
          src="/ica-invisible-guardians-logo-2.jpg" 
          alt="ICA Logo" 
          className="h-16 sm:h-20"
        />
      </div>
      
      {/* Main Content */}
      <main className="w-full max-w-7xl mx-auto py-4 sm:py-8 px-3 sm:px-6 lg:px-8">
        <div className="space-y-8">
          {/* Upload Section */}
          <Card className="border border-gray-200 shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardContent className="p-6 sm:p-8">
              <div className="max-w-3xl mx-auto">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent mb-2 sm:mb-3">
                  Extract Passport Data
                </h2>
                <p className="text-sm sm:text-base text-gray-600 mb-6 sm:mb-8 leading-relaxed">
                  Upload passport images to automatically extract and structure their data using advanced AI technology. 
                  The system supports batch processing for multiple passports with secure data handling.
                </p>
                <PassportUpload onDataExtracted={setPassportDataList} />
              </div>
            </CardContent>
          </Card>

          {/* Results Section */}
          {passportDataList.length > 0 && (
            <Card className="border border-gray-200 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardContent className="p-4 sm:p-8">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 mb-6">
                  <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                    Extracted Data ({passportDataList.length} passport{passportDataList.length !== 1 ? "s" : ""})
                  </h2>
                  <Button 
                    onClick={exportToCSV} 
                    variant="outline" 
                    className="w-full sm:w-auto gap-2 border-primary/20 hover:border-primary/40 hover:bg-primary/5 transition-all duration-300"
                  >
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