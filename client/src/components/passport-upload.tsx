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
      const batchSize = 5;
      const results = [];
      
      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(async (file) => {
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
        
        results.push(...batchResults);
        // Small delay between batches to prevent overload
        if (i + batchSize < files.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

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

  const [analyzingProgress, setAnalyzingProgress] = useState(0);

  const analyzeFiles = async (files: File[]) => {
    const processedFiles = Array.from(files);
    setSelectedFiles(processedFiles);
    if (processedFiles.length > 0) {
      extractData.mutate(processedFiles);
    }
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

        {analyzingProgress > 0 && (
          <div className="mt-4 space-y-2">
            <Progress value={analyzingProgress} className="w-full" />
            <p className="text-sm text-gray-500">
              Analyzing images... {Math.round(analyzingProgress)}%
            </p>
          </div>
        )}

        {extractData.isPending && (
          <div className="mt-4 space-y-2">
            <Progress value={progress} className="w-full" />
            <p className="text-sm text-gray-500">
              Processing {completedFiles} of {extractData.variables?.length} images...
            </p>
          </div>
        )}
      </div>

      
    </>
  );
}