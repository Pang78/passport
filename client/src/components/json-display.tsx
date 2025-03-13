import { Card, CardContent } from "@/components/ui/card";
import PassportUpload from "@/components/passport-upload";
import CameraCapture from "@/components/camera-capture";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Upload, Camera } from "lucide-react";
import { useState } from "react";
import { validatePassportData } from "@/lib/validation";
import { PassportData } from "@/lib/types";

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
      "Overall Confidence",
      "Remarks",
      "Valid",
      "Extraction Notes",
      "Image URL" //Added Image URL to CSV export
    ].map(header => `"${header}"`).join(",");

    // Create CSV rows
    const rows = passportDataList.map((data) => [
      typeof data.fullName === 'object' ? data.fullName.value : data.fullName || "",
      typeof data.dateOfBirth === 'object' ? data.dateOfBirth.value : data.dateOfBirth || "",
      typeof data.passportNumber === 'object' ? data.passportNumber.value : data.passportNumber || "",
      typeof data.nationality === 'object' ? data.nationality.value : data.nationality || "",
      typeof data.dateOfIssue === 'object' ? data.dateOfIssue.value : data.dateOfIssue || "",
      typeof data.dateOfExpiry === 'object' ? data.dateOfExpiry.value : data.dateOfExpiry || "",
      typeof data.placeOfBirth === 'object' ? data.placeOfBirth.value : data.placeOfBirth || "",
      typeof data.issuingAuthority === 'object' ? data.issuingAuthority.value : data.issuingAuthority || "",
      data.mrz?.line1 || "",
      data.mrz?.line2 || "",
      data.overall_confidence?.toFixed(2) || "0",
      Array.isArray(data.remarks) ? data.remarks.join("; ") : String(data.remarks || ""),
      data.isValid ? "Yes" : "No",
      Array.isArray(data.extraction_notes) ? data.extraction_notes.join("; ") : String(data.extraction_notes || ""),
      data.imageUrl || "" //Added Image URL to CSV export
    ].map(value => `"${String(value).replace(/"/g, '""')}"`).join(","));

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

  const handleDataExtracted = (data: PassportData[]) => {
    // Validate each passport data and add remarks
    const validatedData = data.map(passport => {
      const { isValid, remarks } = validatePassportData(passport);
      return {
        ...passport,
        isValid,
        remarks: [
          ...(remarks || []),
          ...(passport.extraction_notes || []),
          ...(passport.overall_confidence !== undefined && passport.overall_confidence < 0.5 
            ? [`Low confidence extraction (${(passport.overall_confidence * 100).toFixed(1)}%)`] 
            : [])
        ],
      };
    });
    setPassportDataList(validatedData);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-gray-50">
      {/* Header */}
      <header className="bg-primary/95 text-primary-foreground shadow-md backdrop-blur-sm sticky top-0 z-10">
        <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            <div className="flex items-center gap-2 sm:gap-3">
              <img
                src="/icalogo.png"
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
                  Choose how you want to capture passport data. Use your device's camera for instant capture or upload existing images.
                </p>
                <Tabs defaultValue="upload" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="upload" className="gap-2">
                      <Upload className="h-4 w-4" />
                      Upload Files
                    </TabsTrigger>
                    <TabsTrigger value="camera" className="gap-2">
                      <Camera className="h-4 w-4" />
                      Use Camera
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="upload">
                    <PassportUpload onDataExtracted={handleDataExtracted} />
                  </TabsContent>
                  <TabsContent value="camera">
                    <CameraCapture onImageCaptured={handleDataExtracted} />
                  </TabsContent>
                </Tabs>
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

                {/* Structured Table */}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Full Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Passport Number</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nationality</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date of Birth</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date of Expiry</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valid</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Confidence</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Image URL</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {passportDataList.map((data, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {typeof data.fullName === 'object' ? data.fullName.value : data.fullName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {typeof data.passportNumber === 'object' ? data.passportNumber.value : data.passportNumber}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {typeof data.nationality === 'object' ? data.nationality.value : data.nationality}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {typeof data.dateOfBirth === 'object' ? data.dateOfBirth.value : data.dateOfBirth}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {typeof data.dateOfExpiry === 'object' ? data.dateOfExpiry.value : data.dateOfExpiry}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{data.isValid ? "Yes" : "No"}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {data.overall_confidence !== undefined ? `${(data.overall_confidence * 100).toFixed(1)}%` : "N/A"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{data.imageUrl}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}