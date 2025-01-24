import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileWarning } from "lucide-react";
import type { PassportData } from "@/pages/home";

interface PassportUploadProps {
  onDataExtracted: (data: PassportData[]) => void;
}

export default function PassportUpload({ onDataExtracted }: PassportUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const extractData = useMutation({
    mutationFn: async (files: File[]) => {
      const results: PassportData[] = [];
      const total = files.length;

      for (let i = 0; i < files.length; i++) {
        const formData = new FormData();
        formData.append("image", files[i]);

        const response = await fetch("/api/extract-passport", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error(await response.text());
        }

        const data = await response.json();
        results.push(data);
        setProgress(((i + 1) / total) * 100);
      }

      return results;
    },
    onSuccess: (data) => {
      onDataExtracted(data);
      toast({
        title: "Success",
        description: `${data.length} passport(s) processed successfully`,
      });
      setProgress(0);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setProgress(0);
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

    const files = Array.from(e.dataTransfer?.files || []).filter(
      file => file.type === "image/jpeg" || file.type === "image/png"
    );

    if (files.length > 0) {
      extractData.mutate(files);
    } else {
      toast({
        title: "Invalid files",
        description: "Please upload JPG or PNG images only",
        variant: "destructive",
      });
    }
  }, [extractData, toast]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      extractData.mutate(files);
    }
  }, [extractData]);

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
        accept="image/jpeg,image/png"
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
          <p className="text-sm text-gray-500">Processing images...</p>
        </div>
      )}
    </div>
  );
}