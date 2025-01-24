import { useRef, useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Camera, StopCircle } from "lucide-react";

interface CameraCaptureProps {
  onCapture: (imageData: string) => void;
  className?: string;
}

export const CameraCapture = ({ onCapture, className = "" }: CameraCaptureProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsStreaming(true);
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsStreaming(false);
    }
  };

  const captureImage = () => {
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      onCapture(imageData);
      stopCamera();
    }
  };

  return (
    <Card className={`${className} overflow-hidden`}>
      <CardContent className="p-4">
        <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          {isStreaming && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
              <Button onClick={captureImage} variant="default">
                <Camera className="w-4 h-4 mr-2" />
                Capture
              </Button>
              <Button onClick={stopCamera} variant="destructive">
                <StopCircle className="w-4 h-4 mr-2" />
                Stop
              </Button>
            </div>
          )}
          {!isStreaming && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Button onClick={startCamera} variant="outline" size="lg">
                <Camera className="w-6 h-6 mr-2" />
                Start Camera
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
