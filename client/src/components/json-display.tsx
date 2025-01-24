import { Card } from "@/components/ui/card";
import type { PassportData } from "@/pages/home";

interface JsonDisplayProps {
  data: PassportData;
}

export default function JsonDisplay({ data }: JsonDisplayProps) {
  return (
    <div className="space-y-4">
      <Card className="p-4 bg-gray-50">
        <pre className="text-sm overflow-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(data).map(([key, value]) => {
          if (key === "mrz" || typeof value === "object") return null;
          return (
            <div key={key} className="space-y-1">
              <dt className="text-sm font-medium text-gray-500 capitalize">
                {key.replace(/([A-Z])/g, " $1").trim()}
              </dt>
              <dd className="text-sm font-semibold text-gray-900">
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