import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileWarning, AlertCircle } from "lucide-react";
import type { PassportData } from "@/pages/home";

interface PassportUploadProps {
  onDataExtracted: (data: PassportData[]) => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes
const SUPPORTED_FORMATS = ['image/jpeg', 'image/png'];

export default function PassportUpload({ onDataExtracted }: PassportUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [completedFiles, setCompletedFiles] = useState(0);
  const { toast } = useToast();

  const validateFiles = (files: File[]): { valid: File[], errors: string[] } => {
    const validFiles: File[] = [];
    const errors: string[] = [];

    files.forEach(file => {
      if (!SUPPORTED_FORMATS.includes(file.type)) {
        errors.push(`${file.name}: Unsupported file format. Please use JPG or PNG files only.`);
      } else if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: File size exceeds 5MB limit.`);
      } else {
        validFiles.push(file);
      }
    });

    return { valid: validFiles, errors };
  };

  const extractData = useMutation({
    mutationFn: async (files: File[]) => {
      setCompletedFiles(0);
      const { valid, errors } = validateFiles(files);

      if (errors.length > 0) {
        errors.forEach(error => {
          toast({
            title: "File Error",
            description: error,
            variant: "destructive",
          });
        });
      }

      if (valid.length === 0) {
        throw new Error("No valid files to process");
      }

      // Process all valid files concurrently
      const results = await Promise.all(
        valid.map(async (file) => {
          const formData = new FormData();
          formData.append("image", file);

          try {
            const response = await fetch("/api/extract-passport", {
              method: "POST",
              body: formData,
            });

            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`Failed to process ${file.name}: ${errorText}`);
            }

            const data = await response.json();
            setCompletedFiles(prev => prev + 1);
            return data;
          } catch (error: any) {
            throw new Error(`Error processing ${file.name}: ${error.message}`);
          }
        })
      );

      return results;
    },
    onSuccess: (data) => {
      onDataExtracted(data);
      toast({
        title: "Success",
        description: `${data.length} passport(s) processed successfully`,
      });
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

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length > 0) {
      extractData.mutate(files);
    }
  }, [extractData]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      extractData.mutate(files);
    }
  }, [extractData]);

  const progress = extractData.isPending && completedFiles > 0
    ? (completedFiles / (extractData.variables?.length || 1)) * 100
    : 0;

  return (
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
        accept={SUPPORTED_FORMATS.join(",")}
        onChange={handleChange}
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
          <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
            <AlertCircle className="w-4 h-4" />
            <span>Maximum file size: 5MB. Supports JPG and PNG files only.</span>
          </div>
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
  );
}