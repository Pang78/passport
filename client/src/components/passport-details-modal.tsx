
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { PassportData } from "@/lib/types";

interface PassportDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: PassportData | null;
  imageUrl?: string;
}

export function PassportDetailsModal({ isOpen, onClose, data, imageUrl }: PassportDetailsModalProps) {
  if (!data) return null;

  const formatValue = (value: any) => {
    if (typeof value === 'object' && value !== null && 'value' in value) {
      return value.value;
    }
    return value;
  };

  const getConfidenceColor = (score?: number) => {
    if (!score) return 'text-gray-500';
    if (score < 0.5) return 'text-red-500';
    if (score < 0.8) return 'text-yellow-500';
    return 'text-green-500';
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Passport Details</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {imageUrl && (
            <div className="border rounded-lg p-2">
              <img src={imageUrl} alt="Passport" className="w-full object-contain" />
            </div>
          )}
          <Table>
            <TableBody>
              {Object.entries(data).map(([key, value]) => {
                if (key === 'confidence_scores' || key === 'mrz' || key === 'remarks' || key === 'extraction_notes') return null;
                return (
                  <TableRow key={key}>
                    <TableCell className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1')}</TableCell>
                    <TableCell>{formatValue(value)}</TableCell>
                    <TableCell className={getConfidenceColor(data.confidence_scores?.[key as keyof typeof data.confidence_scores])}>
                      {data.confidence_scores?.[key as keyof typeof data.confidence_scores]?.toFixed(2) || 'N/A'}
                    </TableCell>
                  </TableRow>
                )}
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
