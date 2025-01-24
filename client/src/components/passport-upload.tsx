import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileWarning } from "lucide-react";
import type { PassportData } from "@/pages/home";

interface PassportUploadProps {
  onDataExtracted: (data: PassportData) => void;
}

export default function PassportUpload({ onDataExtracted }: PassportUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const { toast } = useToast();

  const extractData = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch("/api/extract-passport", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: (data) => {
      onDataExtracted(data);
      toast({
        title: "Success",
        description: "Passport data extracted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
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

    const file = e.dataTransfer?.files?.[0];
    if (file && (file.type === "image/jpeg" || file.type === "image/png")) {
      extractData.mutate(file);
    } else {
      toast({
        title: "Invalid file",
        description: "Please upload a JPG or PNG image",
        variant: "destructive",
      });
    }
  }, [extractData, toast]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      extractData.mutate(file);
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
            Upload passport image
          </label>
          <p className="text-xs text-gray-500">
            Drop your image here or click to browse
          </p>
          <p className="text-xs text-gray-500">
            Supports JPG and PNG files
          </p>
        </div>

        <Button
          type="button"
          onClick={() => document.getElementById("file-upload")?.click()}
          disabled={extractData.isPending}
        >
          Select File
        </Button>
      </div>

      {extractData.isPending && (
        <div className="mt-4 space-y-2">
          <Progress value={33} className="w-full" />
          <p className="text-sm text-gray-500">Processing image...</p>
        </div>
      )}
    </div>
  );
}
