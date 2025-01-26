import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileWarning, X, AlertTriangle } from "lucide-react";
import { type PassportData, type PreviewFile } from "@/lib/types";
import { getImageDataUrl, checkImageQuality } from "@/lib/image-processing";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PassportUploadProps {
  onDataExtracted: (data: PassportData[]) => void;
}

export default function PassportUpload({ onDataExtracted }: PassportUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [completedFiles, setCompletedFiles] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<PreviewFile[]>([]);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const { toast } = useToast();

  const extractData = useMutation({
    mutationFn: async (files: File[]) => {
      setCompletedFiles(0);
      const results = await Promise.all(
        files.map(async (file) => {
          const formData = new FormData();
          formData.append("image", file);

          const response = await fetch("/api/extract-passport", {
            method: "POST",
            body: formData,
          });

          if (!response.ok) {
            throw new Error(`Failed to process ${file.name}: ${await response.text()}`);
          }

          const data = await response.json();
          setCompletedFiles(prev => prev + 1);
          return data;
        })
      );

      return results;
    },
    onSuccess: (data) => {
      console.group('File Upload Processing');
      console.log('Timestamp:', new Date().toISOString());
      console.log('New Data:', data);
      console.groupEnd();

      onDataExtracted(data);
      toast({
        title: "Success",
        description: `${data.length} passport(s) processed successfully`,
      });
      setSelectedFiles([]);
      setCompletedFiles(0);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setCompletedFiles(0);
    },
  });

  const analyzeFiles = async (files: File[]) => {
    const analyzedFiles: PreviewFile[] = [];

    for (const file of files) {
      const [preview, quality] = await Promise.all([
        getImageDataUrl(file),
        checkImageQuality(file),
      ]);

      analyzedFiles.push(Object.assign(file, { preview, quality }));
    }

    setSelectedFiles(analyzedFiles);
    setPreviewDialogOpen(true);
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer?.files || []).filter(
      file => file.type === "image/jpeg" || file.type === "image/png"
    );

    if (files.length > 0) {
      await analyzeFiles(files);
    } else {
      toast({
        title: "Invalid files",
        description: "Please upload JPG or PNG images only",
        variant: "destructive",
      });
    }
  }, [toast]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      await analyzeFiles(files);
    }
  }, []);

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const startProcessing = () => {
    if (selectedFiles.length > 0) {
      extractData.mutate(selectedFiles);
      setPreviewDialogOpen(false);
    }
  };

  const progress = extractData.isPending && completedFiles > 0
    ? (completedFiles / (extractData.variables?.length || 1)) * 100
    : 0;

  return (
    <>
      <div
        className={`relative border-2 border-dashed rounded-lg p-8 text-center ${
          dragActive ? "border-primary bg-primary/5" : "border-gray-300"
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="file-upload"
          className="hidden"
          accept="image/jpeg,image/png"
          onChange={handleFileChange}
          disabled={extractData.isPending}
          multiple
        />

        <div className="space-y-4">
          <div className="mx-auto w-12 h-12 text-gray-400">
            {extractData.isError ? (
              <FileWarning className="w-12 h-12 text-destructive" />
            ) : (
              <Upload className="w-12 h-12" />
            )}
          </div>

          <div className="space-y-2">
            <label
              htmlFor="file-upload"
              className="block text-sm font-medium text-gray-700"
            >
              Upload passport images
            </label>
            <p className="text-xs text-gray-500">
              Drop your images here or click to browse
            </p>
            <p className="text-xs text-gray-500">
              Supports multiple JPG and PNG files
            </p>
          </div>

          <Button
            type="button"
            onClick={() => document.getElementById("file-upload")?.click()}
            disabled={extractData.isPending}
          >
            Select Files
          </Button>
        </div>

        {extractData.isPending && (
          <div className="mt-4 space-y-2">
            <Progress value={progress} className="w-full" />
            <p className="text-sm text-gray-500">
              Processing {completedFiles} of {extractData.variables?.length} images...
            </p>
          </div>
        )}
      </div>

      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Preview Selected Images</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4 overflow-y-auto flex-1 pr-2">
            {selectedFiles.map((file, index) => (
              <div key={index} className="relative">
                <div className="aspect-[3/4] relative rounded-lg overflow-hidden border border-gray-200">
                  <img
                    src={file.preview}
                    alt={`Preview ${index + 1}`}
                    className="object-cover w-full h-full"
                  />
                  <button
                    onClick={() => removeFile(index)}
                    className="absolute top-2 right-2 p-1 rounded-full bg-white/80 hover:bg-white/90 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  {!file.quality?.isValid && (
                    <div className="absolute bottom-2 right-2 px-2 py-1 rounded-full bg-red-500/80 text-white text-xs flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {file.quality?.message || 'Quality issues detected'}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-4 mt-4">
            <Button variant="outline" onClick={() => setPreviewDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={startProcessing} disabled={selectedFiles.length === 0}>
              Process {selectedFiles.length} image{selectedFiles.length !== 1 ? 's' : ''}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}