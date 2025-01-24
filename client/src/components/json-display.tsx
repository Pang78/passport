import { Card } from "@/components/ui/card";
import type { PassportData } from "@/pages/home";
import { cn } from "@/lib/utils";

interface JsonDisplayProps {
  data: PassportData;
}

export default function JsonDisplay({ data }: JsonDisplayProps) {
  const hasRemarks = data.remarks && data.remarks.length > 0;

  const getConfidenceColor = (score: number) => {
    if (score < 0.5) return "text-red-600";
    if (score < 0.8) return "text-yellow-600";
    return "text-green-600";
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-gray-50">
        <pre className="text-sm overflow-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(data).map(([key, value]) => {
          if (key === "mrz" || key === "remarks" || key === "isValid" || key === "confidence_scores" || key === "overall_confidence" || key === "extraction_notes" || typeof value === "object") return null;

          const hasIssue = hasRemarks && data.remarks?.some(remark => remark.toLowerCase().includes(key.toLowerCase()));
          const confidenceScore = data.confidence_scores?.[key as keyof typeof data.confidence_scores];

          return (
            <div key={key} className="space-y-1">
              <dt className="text-sm font-medium text-gray-500 capitalize flex justify-between items-center">
                <span>{key.replace(/([A-Z])/g, " $1").trim()}</span>
                {confidenceScore !== undefined && (
                  <span className={cn(
                    "text-xs font-normal",
                    getConfidenceColor(confidenceScore)
                  )}>
                    {(confidenceScore * 100).toFixed(1)}% confidence
                  </span>
                )}
              </dt>
              <dd className={cn(
                "text-sm font-semibold",
                hasIssue ? "text-red-600" : "text-gray-900"
              )}>
                {typeof value === 'object' && value !== null ? 
                  value.value || JSON.stringify(value) : 
                  String(value)}
              </dd>
            </div>
          );
        })}
      </div>

      {data.mrz && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-medium text-gray-500">MRZ Data</h3>
            {data.confidence_scores?.mrz !== undefined && (
              <span className={cn(
                "text-xs",
                getConfidenceColor(data.confidence_scores.mrz)
              )}>
                {(data.confidence_scores.mrz * 100).toFixed(1)}% confidence
              </span>
            )}
          </div>
          <div className="font-mono text-xs bg-gray-50 p-3 rounded">
            <div>{data.mrz.line1}</div>
            <div>{data.mrz.line2}</div>
          </div>
        </div>
      )}
    </div>
  );
}