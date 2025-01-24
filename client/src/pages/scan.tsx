import { DocumentScanner } from "@/components/DocumentScanner";

export default function ScanPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <h1 className="text-2xl font-bold mb-6 text-center">
          Document Scanner
        </h1>
        <DocumentScanner />
      </div>
    </div>
  );
}
