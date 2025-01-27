import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Camera, RotateCw, Lightbulb, CropIcon, Maximize2 } from "lucide-react";
import type { PassportData } from "@/pages/home";

interface CameraCaptureProps {
  onImageCaptured: (data: PassportData[]) => void;
}

const CameraCapture = ({ onImageCaptured }: CameraCaptureProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string>("");
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const [cropStart, setCropStart] = useState<{ x: number; y: number } | null>(null);
  const [cropEnd, setCropEnd] = useState<{ x: number; y: number } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false); // Added loading state
  const { toast } = useToast();

  const initializeCamera = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setDevices(videoDevices);

      if (videoDevices.length === 0) {
        throw new Error("No camera devices found");
      }

      const deviceId = videoDevices[0].deviceId;
      setActiveDeviceId(deviceId);

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: deviceId },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });

      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
    } catch (error: any) {
      toast({
        title: "Camera Error",
        description: error.message,
        variant: "destructive",
      });
    }
  }, [toast]);

  const switchCamera = async () => {
    if (!devices.length) return;

    const currentIndex = devices.findIndex(d => d.deviceId === activeDeviceId);
    const nextIndex = (currentIndex + 1) % devices.length;
    const nextDevice = devices[nextIndex];

    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: nextDevice.deviceId },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });

      setStream(newStream);
      setActiveDeviceId(nextDevice.deviceId);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
    } catch (error: any) {
      toast({
        title: "Camera Switch Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const toggleFlash = async () => {
    if (!stream) return;

    try {
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities();
      const settings = track.getSettings();

      // Some devices expose torch through a custom implementation
      const hasFlash = 'torch' in capabilities || 'fillLightMode' in capabilities;

      if (hasFlash) {
        try {
          // Try standard torch control
          await track.applyConstraints({
            advanced: [{ torch: !flashEnabled }]
          });
          setFlashEnabled(!flashEnabled);
        } catch {
          // Fallback to fillLightMode if available
          await track.applyConstraints({
            advanced: [{ fillLightMode: flashEnabled ? "none" : "flash" }]
          });
          setFlashEnabled(!flashEnabled);
        }
      } else {
        toast({
          title: "Flash not available",
          description: "Your device does not support flash control",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Flash Error",
        description: "Unable to control flash",
        variant: "destructive",
      });
    }
  };

  const checkImageQuality = async (canvas: HTMLCanvasElement): Promise<{ isValid: boolean; message?: string }> => {
    try {
      const base64Image = canvas.toDataURL('image/jpeg', 0.95);
      const formData = new FormData();
      const blob = await (await fetch(base64Image)).blob();
      formData.append('image', blob, 'check.jpg');

      const response = await fetch('/api/check-quality', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const result = await response.json();
      return {
        isValid: result.isValid,
        message: result.message
      };
    } catch (error) {
      console.error('Quality check error:', error);
      return { isValid: true }; // Fallback to accepting the image if API fails
    }
  };

  const [previewImage, setPreviewImage] = useState<string | null>(null);

const captureImage = async () => {
    if (!videoRef.current || !canvasRef.current) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    context.drawImage(video, 0, 0);

    if (isCropping && cropStart && cropEnd) {
      const cropWidth = Math.abs(cropEnd.x - cropStart.x);
      const cropHeight = Math.abs(cropEnd.y - cropStart.y);
      const cropX = Math.min(cropStart.x, cropEnd.x);
      const cropY = Math.min(cropStart.y, cropEnd.y);

      const croppedImageData = context.getImageData(cropX, cropY, cropWidth, cropHeight);
      canvas.width = cropWidth;
      canvas.height = cropHeight;
      context.putImageData(croppedImageData, 0, 0);
    }

    const previewDataUrl = canvas.toDataURL('image/jpeg', 0.95);
    setPreviewImage(previewDataUrl);

    const qualityCheck = await checkImageQuality(canvas);

    if (!qualityCheck.isValid) {
      toast({
        title: "Quality Check Failed",
        description: qualityCheck.message,
        variant: "destructive",
      });
      setIsProcessing(false); // Set loading state to false
      return;
    }

    try {
      const base64Image = canvas.toDataURL('image/jpeg', 0.95);

      const formData = new FormData();
      const blob = await (await fetch(base64Image)).blob();
      formData.append('image', blob, 'passport.jpg');

      const response = await fetch('/api/extract-passport', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = await response.json();
      console.log('Camera capture processed:', data);
      onImageCaptured([data]);

      toast({
        title: "Success",
        description: "Image captured and processed successfully",
      });
      setIsProcessing(false); // Set loading state to false
    } catch (error: any) {
      toast({
        title: "Processing Error",
        description: error.message,
        variant: "destructive",
      });
      setIsProcessing(false); // Set loading state to false
    }
  };

  useEffect(() => {
    initializeCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [initializeCamera]);

  const processImage = async () => {
    setIsProcessing(true);
    if (!previewImage) return;

    const qualityCheck = await checkImageQuality(canvasRef.current!);

    if (!qualityCheck.isValid) {
      toast({
        title: "Quality Check Failed",
        description: qualityCheck.message,
        variant: "destructive",
      });
      setIsProcessing(false);
      return;
    }

    try {
      const formData = new FormData();
      const blob = await (await fetch(previewImage)).blob();
      formData.append('image', blob, 'passport.jpg');

      const response = await fetch('/api/extract-passport', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = await response.json();
      console.log('Camera capture processed:', data);
      onImageCaptured([data]);

      toast({
        title: "Success",
        description: "Image captured and processed successfully",
      });
      setPreviewImage(null);
    } catch (error: any) {
      toast({
        title: "Processing Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <div className="relative border rounded-lg p-4">
      <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />

        {isCropping && (
          <div
            className="absolute inset-0 cursor-crosshair"
            onMouseDown={e => {
              const rect = e.currentTarget.getBoundingClientRect();
              setCropStart({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
              });
            }}
            onMouseMove={e => {
              if (!cropStart) return;
              const rect = e.currentTarget.getBoundingClientRect();
              setCropEnd({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
              });
            }}
            onMouseUp={() => {
              if (cropStart && cropEnd) {
                setIsCropping(false);
              }
              setCropStart(null);
              setCropEnd(null);
            }}
          >
            {cropStart && cropEnd && (
              <div
                className="absolute border-2 border-primary bg-primary/20"
                style={{
                  left: Math.min(cropStart.x, cropEnd.x),
                  top: Math.min(cropStart.y, cropEnd.y),
                  width: Math.abs(cropEnd.x - cropStart.x),
                  height: Math.abs(cropEnd.y - cropStart.y),
                }}
              />
            )}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={toggleFlash}
            className={flashEnabled ? "bg-yellow-100" : ""}
          >
            <Lightbulb className={`h-4 w-4 ${flashEnabled ? "text-yellow-500" : ""}`} />
          </Button>

          {devices.length > 1 && (
            <Button
              variant="outline"
              size="icon"
              onClick={switchCamera}
              disabled={isProcessing} // Disable button during processing
            >
              <RotateCw className="h-4 w-4" />
            </Button>
          )}

          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsCropping(!isCropping)}
            disabled={isProcessing} // Disable button during processing
            className={isCropping ? "bg-primary/10" : ""}
          >
            {isCropping ? (
              <Maximize2 className="h-4 w-4" />
            ) : (
              <CropIcon className="h-4 w-4" />
            )}
          </Button>
        </div>

        <Button onClick={captureImage} disabled={isProcessing} className="gap-2">
          <Camera className="h-4 w-4" />
          {isProcessing ? "Processing..." : "Capture"}
        </Button>
      </div>
      </div>
      
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Preview Captured Image</DialogTitle>
          </DialogHeader>
          {previewImage && (
            <div className="space-y-4">
              <div className="aspect-[3/4] relative rounded-lg overflow-hidden border">
                <img
                  src={previewImage}
                  alt="Captured preview"
                  className="object-contain w-full h-full"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPreviewImage(null)}>
                  Retake
                </Button>
                <Button onClick={processImage} disabled={isProcessing}>
                  {isProcessing ? "Processing..." : "Process Image"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CameraCapture;