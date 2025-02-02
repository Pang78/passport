import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileWarning, X, AlertTriangle, Image as ImageIcon } from "lucide-react";
import { type PassportData, type PreviewFile } from "@/lib/types";
import { getImageDataUrl, checkImageQuality, needsOptimization } from "@/lib/image-processing";
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
  const [analyzingProgress, setAnalyzingProgress] = useState(0);
  const { toast } = useToast();

  const extractData = useMutation({
    mutationFn: async (files: File[]) => {
      setCompletedFiles(0);
      const batchSize = 5;
      const results = [];

      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        setAnalyzingProgress((i / files.length) * 100);

        const batchResults = await Promise.all(
          batch.map(async (file) => {
            try {
              const startTime = performance.now();

              // Check image quality first
              const qualityCheck = await checkImageQuality(file);
              if (!qualityCheck.isValid) {
                throw new Error(`Quality check failed: ${qualityCheck.issues?.join(", ")}`);
              }

              // Compress image if needed
              const optimizedImage = await getImageDataUrl(
                file,
                needsOptimization(file) ? 500 : undefined
              );

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
              const endTime = performance.now();
              console.log(`Processing time for ${file.name}: ${(endTime - startTime).toFixed(2)}ms`);

              setCompletedFiles(prev => prev + 1);

              return {
                ...data,
                passportPhoto: optimizedImage,
                file_name: file.name,
              };
            } catch (error) {
              console.error(`Error processing ${file.name}:`, error);
              toast({
                title: "Processing Error",
                description: error instanceof Error ? error.message : "Unknown error",
                variant: "destructive",
              });
              return null;
            }
          })
        );

        // Filter out failed extractions
        const validResults = batchResults.filter(result => result !== null);
        results.push(...validResults);

        if (i + batchSize < files.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      setAnalyzingProgress(100);
      return results;
    },
    onSuccess: (data) => {
      console.group('File Upload Processing');
      console.log('Timestamp:', new Date().toISOString());
      console.log('Processed Files:', data.length);
      console.groupEnd();

      onDataExtracted(data);
      toast({
        title: "Success",
        description: `${data.length} passport(s) processed successfully`,
      });
      setSelectedFiles([]);
      setCompletedFiles(0);
      setAnalyzingProgress(0);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setCompletedFiles(0);
      setAnalyzingProgress(0);
    },
  });

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

    if (files.length === 0) {
      toast({
        title: "Invalid files",
        description: "Please upload JPG or PNG images only",
        variant: "destructive",
      });
      return;
    }

    // Preview files first
    try {
      const previewFiles = await Promise.all(
        files.map(async (file) => ({
          file,
          preview: await getImageDataUrl(file, 200), // Small preview size
          name: file.name,
        }))
      );
      setSelectedFiles(previewFiles);
      setPreviewDialogOpen(true);
    } catch (error) {
      console.error('Preview generation error:', error);
      toast({
        title: "Preview Error",
        description: "Failed to generate image previews",
        variant: "destructive",
      });
    }
  }, [toast]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      try {
        const previewFiles = await Promise.all(
          files.map(async (file) => ({
            file,
            preview: await getImageDataUrl(file, 200),
            name: file.name,
          }))
        );
        setSelectedFiles(previewFiles);
        setPreviewDialogOpen(true);
      } catch (error) {
        console.error('Preview generation error:', error);
        toast({
          title: "Preview Error",
          description: "Failed to generate image previews",
          variant: "destructive",
        });
      }
    }
  }, [toast]);

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const startProcessing = () => {
    if (selectedFiles.length > 0) {
      extractData.mutate(selectedFiles.map(f => f.file));
      setPreviewDialogOpen(false);
    }
  };

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

        {(analyzingProgress > 0 || extractData.isPending) && (
          <div className="mt-4 space-y-2">
            <Progress 
              value={extractData.isPending ? (completedFiles / (selectedFiles.length || 1)) * 100 : analyzingProgress} 
              className="w-full" 
            />
            <p className="text-sm text-gray-500">
              {extractData.isPending 
                ? `Processing ${completedFiles} of ${selectedFiles.length} images...`
                : `Analyzing images... ${Math.round(analyzingProgress)}%`
              }
            </p>
          </div>
        )}
      </div>

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Preview Images</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4">
            {selectedFiles.map((file, index) => (
              <div key={index} className="relative group">
                <img
                  src={file.preview}
                  alt={file.name}
                  className="w-full h-32 object-cover rounded-lg"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removeFile(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
                <p className="text-xs text-gray-500 mt-1 truncate">{file.name}</p>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPreviewDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={startProcessing} disabled={selectedFiles.length === 0}>
              Process {selectedFiles.length} Image{selectedFiles.length !== 1 ? 's' : ''}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}