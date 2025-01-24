import { Card } from "@/components/ui/card";
import type { PassportData } from "@/pages/home";
import { cn } from "@/lib/utils";

interface JsonDisplayProps {
  data: PassportData;
}

export default function JsonDisplay({ data }: JsonDisplayProps) {
  const hasRemarks = data.remarks && data.remarks.length > 0;

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-gray-50">
        <pre className="text-sm overflow-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(data).map(([key, value]) => {
          if (key === "mrz" || key === "remarks" || key === "isValid" || typeof value === "object") return null;
          const hasIssue = hasRemarks && data.remarks?.some(remark => remark.toLowerCase().includes(key.toLowerCase()));

          return (
            <div key={key} className="space-y-1">
              <dt className="text-sm font-medium text-gray-500 capitalize">
                {key.replace(/([A-Z])/g, " $1").trim()}
              </dt>
              <dd className={cn(
                "text-sm font-semibold",
                hasIssue ? "text-red-600" : "text-gray-900"
              )}>
                {value as string}
              </dd>
            </div>
          );
        })}
      </div>

      {data.mrz && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-500">MRZ Data</h3>
          <div className="font-mono text-xs bg-gray-50 p-3 rounded">
            <div>{data.mrz.line1}</div>
            <div>{data.mrz.line2}</div>
          </div>
        </div>
      )}
    </div>
  );
}