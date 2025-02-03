import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Camera, RotateCw, Lightbulb } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { PassportData } from "@/lib/types";

interface CameraCaptureProps {
  onImageCaptured: (data: PassportData[]) => void;
}

interface QualityCheckResult {
  isValid: boolean;
  message?: string;
  issues?: string[];
}

const CameraCapture = ({ onImageCaptured }: CameraCaptureProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string>("");
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const { toast } = useToast();

  const stopCurrentStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const initializeDevices = useCallback(async () => {
    try {
      const mediaDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = mediaDevices.filter(device => device.kind === 'videoinput');
      setDevices(videoDevices);
      return videoDevices;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to access media devices';
      setCameraError(errorMessage);
      toast({
        title: "Device Error",
        description: errorMessage,
        variant: "destructive",
      });
      return [];
    }
  }, [toast]);

  const initializeCamera = useCallback(async (deviceId?: string) => {
    setCameraError(null);
    stopCurrentStream();

    try {
      const videoDevices = await initializeDevices();
      if (videoDevices.length === 0) {
        throw new Error("No camera devices available");
      }

      const targetDevice = deviceId 
        ? videoDevices.find(d => d.deviceId === deviceId)
        : videoDevices[0];

      if (!targetDevice) throw new Error("Requested device not found");

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: targetDevice.deviceId,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          facingMode: deviceId ? undefined : "environment"
        },
        audio: false
      });

      streamRef.current = newStream;
      setActiveDeviceId(targetDevice.deviceId);

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        await videoRef.current.play();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Camera initialization failed';
      stopCurrentStream();
      setCameraError(errorMessage);
      toast({
        title: "Camera Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }, [initializeDevices, stopCurrentStream, toast]);

  const toggleFlash = useCallback(async () => {
    if (!streamRef.current) return;

    try {
      const track = streamRef.current.getVideoTracks()[0];
      // @ts-ignore - These properties are available but not in TypeScript definitions
      if (track.getCapabilities?.().torch) {
        await track.applyConstraints({
          advanced: [{ torch: !flashEnabled }]
        });
        setFlashEnabled(!flashEnabled);
      } else {
        throw new Error("Flash not supported by this device");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Flash control failed';
      toast({
        title: "Flash Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }, [flashEnabled, toast]);

  const captureImage = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    try {
      setIsProcessing(true);
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) throw new Error("Canvas context not available");

      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      context.drawImage(videoRef.current, 0, 0);

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else throw new Error("Failed to create image blob");
        }, 'image/jpeg', 0.9);
      });

      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result as string);
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Image capture failed';
      toast({
        title: "Capture Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [toast]);

  const processImage = useCallback(async () => {
    if (!previewImage || !canvasRef.current) return;

    try {
      setIsProcessing(true);
      const formData = new FormData();
      const blob = await fetch(previewImage).then(r => r.blob());
      formData.append('image', blob, 'passport.jpg');

      const response = await fetch('/api/extract-passport', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const result = await response.json();
      onImageCaptured([result]);
      setPreviewImage(null);

      toast({
        title: "Success",
        description: "Passport data extracted successfully",
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Processing failed';
      toast({
        title: "Processing Error",
        description: errorMessage,
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsProcessing(false);
    }
  }, [previewImage, onImageCaptured, toast]);

  useEffect(() => {
    initializeCamera();
    return () => {
      stopCurrentStream();
    };
  }, [initializeCamera, stopCurrentStream]);

  return (
    <div className="space-y-4">
      <div className="relative border rounded-lg p-4 bg-muted/50">
        <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
          {cameraError ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center p-4">
                <p className="text-red-500 mb-2">{cameraError}</p>
                <Button onClick={() => initializeCamera()}>
                  <RotateCw className="mr-2 h-4 w-4" />
                  Retry Camera
                </Button>
              </div>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-contain"
                aria-label="Camera preview"
              />
              <canvas ref={canvasRef} className="hidden" />

              {/* Capture overlay */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="relative h-full">
                  <div className="absolute inset-[15%] border-2 border-primary/50 rounded-lg">
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-primary/75 text-white px-3 py-1 rounded-full text-sm">
                      Align passport within frame
                    </div>
                    <div className="absolute top-0 left-0 w-[20px] h-[20px] border-t-2 border-l-2 border-primary"></div>
                    <div className="absolute top-0 right-0 w-[20px] h-[20px] border-t-2 border-r-2 border-primary"></div>
                    <div className="absolute bottom-0 left-0 w-[20px] h-[20px] border-b-2 border-l-2 border-primary"></div>
                    <div className="absolute bottom-0 right-0 w-[20px] h-[20px] border-b-2 border-r-2 border-primary"></div>
                  </div>
                </div>
              </div>

              {/* Capture controls */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-4">
                <Button
                  size="icon"
                  onClick={captureImage}
                  disabled={isProcessing}
                  aria-label="Take photo"
                  className="h-16 w-16 rounded-full shadow-lg"
                >
                  <Camera className="h-8 w-8" />
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Device controls */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={toggleFlash}
              disabled={!streamRef.current}
              aria-label={flashEnabled ? "Disable flash" : "Enable flash"}
            >
              <Lightbulb className={`h-4 w-4 ${flashEnabled ? "text-yellow-500 fill-current" : ""}`} />
            </Button>

            {devices.length > 1 && (
              <select
                value={activeDeviceId}
                onChange={(e) => switchDevice(e.target.value)}
                disabled={isProcessing}
                className="rounded-md border bg-background px-3 py-2 text-sm"
                aria-label="Select camera device"
              >
                {devices.map(device => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="text-sm text-muted-foreground">
            {isProcessing ? "Processing..." : "Camera ready"}
          </div>
        </div>
      </div>

      {/* Preview dialog */}
      <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Confirm Passport Photo</DialogTitle>
          </DialogHeader>

          {previewImage && (
            <div className="space-y-4">
              <div className="relative aspect-[3/2] rounded-lg overflow-hidden border">
                <img
                  src={previewImage}
                  alt="Captured passport preview"
                  className="object-contain w-full h-full"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setPreviewImage(null)}
                  disabled={isProcessing}
                >
                  Retake
                </Button>
                <Button 
                  onClick={processImage}
                  disabled={isProcessing}
                >
                  {isProcessing ? "Processing..." : "Confirm"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CameraCapture;