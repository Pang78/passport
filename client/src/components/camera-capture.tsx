import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Camera, RotateCw, Lightbulb } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { PassportData } from "@/pages/home";

interface CameraCaptureProps {
  onImageCaptured: (data: PassportData[]) => void;
}

interface QualityCheckResult {
  isValid: boolean;
  message?: string;
}

const CameraCapture = ({ onImageCaptured }: CameraCaptureProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string>("");
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  // Camera initialization and device management
  const initializeDevices = useCallback(async () => {
    try {
      const mediaDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = mediaDevices.filter(device => device.kind === 'videoinput');
      setDevices(videoDevices);
      return videoDevices;
    } catch (error) {
      toast({
        title: "Device Error",
        description: "Failed to access media devices",
        variant: "destructive",
      });
      return [];
    }
  }, [toast]);

  const initializeCamera = useCallback(async (deviceId?: string) => {
    try {
      // First try to get direct camera access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          facingMode: "environment"
        }
      });
      
      setStream(prev => {
        prev?.getTracks().forEach(track => track.stop());
        return stream;
      });

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
          height: { ideal: 1080 }
        }
      });

      setStream(prev => {
        prev?.getTracks().forEach(track => track.stop());
        return newStream;
      });
      setActiveDeviceId(targetDevice.deviceId);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => {
              videoRef.current?.play()
                .then(resolve)
                .catch(e => {
                  toast({
                    title: "Playback Error",
                    description: "Failed to start video stream. Please check your camera permissions.",
                    variant: "destructive",
                  });
                });
            };
          }
        });
      }
    } catch (error: any) {
      const message = error.name === 'NotAllowedError' 
        ? "Camera access was denied. Please allow camera access and try again."
        : error.message;
      
      toast({
        title: "Camera Error",
        description: message,
        variant: "destructive",
      });
    }
  }, [initializeDevices, toast]);

  // Device switching handler
  const switchDevice = useCallback(async (deviceId: string) => {
    if (deviceId === activeDeviceId) return;
    await initializeCamera(deviceId);
  }, [activeDeviceId, initializeCamera]);

  // Flash control logic
  const toggleFlash = useCallback(async () => {
    if (!stream) return;

    try {
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities();
      const constraints: MediaTrackConstraintSet = {};

      if ('torch' in capabilities) {
        constraints.torch = !flashEnabled;
      } else if ('fillLightMode' in capabilities) {
        constraints.fillLightMode = flashEnabled ? 'off' : 'flash';
      } else {
        throw new Error("Flash not supported by this device");
      }

      await track.applyConstraints({ advanced: [constraints] as any });
      setFlashEnabled(!flashEnabled);
    } catch (error: any) {
      toast({
        title: "Flash Error",
        description: error.message,
        variant: "destructive",
      });
    }
  }, [stream, flashEnabled, toast]);

  // Image quality validation
  const checkImageQuality = useCallback(async (canvas: HTMLCanvasElement): Promise<QualityCheckResult> => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const blob = await new Promise<Blob>(resolve => 
        canvas.toBlob(blob => blob && resolve(blob), 'image/jpeg', 0.9)
      );

      const formData = new FormData();
      formData.append('image', blob, 'quality-check.jpg');

      const response = await fetch('/api/check-quality', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('Quality check failed:', error);
      return {
        isValid: false,
        message: error.message || 'Failed to validate image quality'
      };
    }
  }, []);

  // Image capture and processing
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

      setPreviewImage(canvas.toDataURL('image/jpeg'));
    } catch (error: any) {
      toast({
        title: "Capture Failed",
        description: error.message,
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
      const qualityResult = await checkImageQuality(canvasRef.current);

      if (!qualityResult.isValid) {
        throw new Error(qualityResult.message || "Image quality check failed");
      }

      const response = await fetch('/api/extract-passport', {
        method: 'POST',
        body: JSON.stringify({ image: previewImage }),
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      onImageCaptured([result]);
      setPreviewImage(null);

      toast({
        title: "Success",
        description: "Passport data extracted successfully",
      });
    } catch (error: any) {
      toast({
        title: "Processing Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [previewImage, checkImageQuality, onImageCaptured, toast]);

  // Camera lifecycle management
  useEffect(() => {
    initializeCamera();
    return () => {
      stream?.getTracks().forEach(track => track.stop());
    };
  }, [initializeCamera, stream]);

  return (
    <div className="space-y-4">
      <div className="relative border rounded-lg p-4 bg-muted/50">
        <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
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
        </div>

        {/* Device controls */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={toggleFlash}
              disabled={!stream}
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