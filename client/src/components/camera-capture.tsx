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

  const checkImageQuality = (imageData: ImageData): { isValid: boolean; message?: string } => {
    const { data, width, height } = imageData;

    let totalBrightness = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      totalBrightness += (r + g + b) / 3;
    }
    const averageBrightness = totalBrightness / (width * height);

    let blurScore = 0;
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
        const neighbors = [
          ((y - 1) * width + x) * 4,
          ((y + 1) * width + x) * 4,
          (y * width + x - 1) * 4,
          (y * width + x + 1) * 4,
        ].map(i => (data[i] + data[i + 1] + data[i + 2]) / 3);

        const variance = neighbors.reduce((sum, val) => sum + Math.abs(val - gray), 0);
        blurScore += variance;
      }
    }
    blurScore /= (width * height);

    if (averageBrightness < 40) {
      return { isValid: false, message: "Image too dark" };
    }
    if (averageBrightness > 215) {
      return { isValid: false, message: "Image too bright" };
    }
    if (blurScore < 20) {
      return { isValid: false, message: "Image too blurry" };
    }

    return { isValid: true };
  };

  const captureImage = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;

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

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const qualityCheck = checkImageQuality(imageData);

    if (!qualityCheck.isValid) {
      toast({
        title: "Quality Check Failed",
        description: qualityCheck.message,
        variant: "destructive",
      });
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
      onImageCaptured([data]);

      toast({
        title: "Success",
        description: "Image captured and processed successfully",
      });
    } catch (error: any) {
      toast({
        title: "Processing Error",
        description: error.message,
        variant: "destructive",
      });
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

  return (
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
            >
              <RotateCw className="h-4 w-4" />
            </Button>
          )}

          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsCropping(!isCropping)}
            className={isCropping ? "bg-primary/10" : ""}
          >
            {isCropping ? (
              <Maximize2 className="h-4 w-4" />
            ) : (
              <CropIcon className="h-4 w-4" />
            )}
          </Button>
        </div>

        <Button onClick={captureImage} className="gap-2">
          <Camera className="h-4 w-4" />
          Capture
        </Button>
      </div>
    </div>
  );
};

export default CameraCapture;