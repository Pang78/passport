
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { PassportData } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface PassportDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: PassportData | null;
  onUpdate: (updatedData: PassportData) => void;
}

export function PassportDetailsModal({ isOpen, onClose, data, onUpdate }: PassportDetailsModalProps) {
  if (!data) return null;

  const [editedData, setEditedData] = useState<PassportData>(data);
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = () => {
    onUpdate(editedData);
    setIsEditing(false);
  };

  const formatValue = (key: string, value: any) => {
    if (typeof value === 'object' && value !== null && 'value' in value) {
      return value.value;
    }
    return value;
  };

  const handleEdit = (key: string, value: string) => {
    setEditedData(prev => ({
      ...prev,
      [key]: typeof data[key] === 'object' ? { value } : value
    }));
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
          <DialogTitle className="flex justify-between items-center">
            <span>Passport Details</span>
            <Button onClick={() => setIsEditing(!isEditing)}>
              {isEditing ? "Cancel" : "Edit"}
            </Button>
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.imageData && (
            <div className="border rounded-lg p-2">
              <img src={data.imageData} alt="Passport" className="w-full object-contain" />
            </div>
          )}
          <Table>
            <TableBody>
              {Object.entries(data).map(([key, value]) => {
                if (key === 'confidence_scores' || key === 'mrz' || key === 'remarks' || key === 'extraction_notes' || key === 'imageData') return null;
                return (
                  <TableRow key={key}>
                    <TableCell className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1')}</TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Input
                          value={formatValue(key, editedData[key])}
                          onChange={(e) => handleEdit(key, e.target.value)}
                        />
                      ) : (
                        formatValue(key, value)
                      )}
                    </TableCell>
                    <TableCell className={getConfidenceColor(data.confidence_scores?.[key as keyof typeof data.confidence_scores])}>
                      {data.confidence_scores?.[key as keyof typeof data.confidence_scores]?.toFixed(2) || 'N/A'}
                    </TableCell>
                  </TableRow>
                )}
              )}
            </TableBody>
          </Table>
        </div>
        {isEditing && (
          <div className="flex justify-end mt-4">
            <Button onClick={handleSave}>Save Changes</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
