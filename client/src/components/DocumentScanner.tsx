import { useRef, useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Camera } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function DocumentScanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const { toast } = useToast();

  // Function to detect MRZ-like text patterns
  const detectMRZ = (imageData: ImageData): boolean => {
    // Simple MRZ pattern detection (looking for consecutive capital letters and numbers)
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return false;

    // Convert image data to grayscale and detect lines
    const data = imageData.data;
    let consecutiveMatches = 0;
    const threshold = 30; // Minimum consecutive characters for MRZ line

    // Basic pattern matching for MRZ-like sequences
    for (let i = 0; i < data.length; i += 4) {
      const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (brightness < 128) { // Dark pixels might be text
        consecutiveMatches++;
        if (consecutiveMatches > threshold) {
          return true; // Potential MRZ line detected
        }
      } else {
        consecutiveMatches = 0;
      }
    }

    return false;
  };

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        setStream(mediaStream);
        setIsScanning(true);
      }
    } catch (error) {
      console.error('Failed to access camera:', error);
      toast({
        title: "Camera Error",
        description: "Could not access camera. Please ensure camera permissions are granted.",
        variant: "destructive",
      });
    }
  };

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setIsScanning(false);
    }
  }, [stream]);

  // Auto-capture process
  useEffect(() => {
    let animationFrameId: number;
    let lastCaptureTime = 0;
    const CAPTURE_INTERVAL = 500; // Check every 500ms

    const checkForMRZ = () => {
      if (!isScanning || !videoRef.current || !canvasRef.current) return;

      const now = Date.now();
      if (now - lastCaptureTime > CAPTURE_INTERVAL) {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        const context = canvas.getContext('2d');

        if (!context) return;

        // Update canvas dimensions to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Draw current video frame to canvas
        context.drawImage(video, 0, 0);

        // Get image data from the bottom third of the frame where MRZ usually is
        const mrzRegionHeight = canvas.height / 3;
        const imageData = context.getImageData(
          0, 
          canvas.height - mrzRegionHeight, 
          canvas.width, 
          mrzRegionHeight
        );

        if (detectMRZ(imageData)) {
          console.log('Potential MRZ detected, capturing...');
          captureImage();
          lastCaptureTime = now;
        }
      }

      animationFrameId = requestAnimationFrame(checkForMRZ);
    };

    if (isScanning) {
      checkForMRZ();
    }

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isScanning]);

  const captureImage = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext('2d');
    if (!context) return;

    context.drawImage(video, 0, 0);
    const imageData = canvas.toDataURL('image/jpeg');

    try {
      const formData = new FormData();
      // Convert base64 to blob
      const response = await fetch(imageData);
      const blob = await response.blob();
      formData.append('image', blob);

      // Send to backend for analysis
      const result = await fetch('/api/analyze-document', {
        method: 'POST',
        body: formData,
      });

      if (!result.ok) {
        throw new Error('Failed to analyze image');
      }

      const data = await result.json();
      console.log('Extracted passport data:', data);

      // If we successfully detected and processed MRZ, stop the camera
      if (data.type === 'passport' && data.confidence > 0.8) {
        stopCamera();
        toast({
          title: "Passport Detected",
          description: "Successfully captured passport information.",
        });
      }
    } catch (error) {
      console.error('Failed to process image:', error);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto p-4">
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex justify-center">
            <Button
              onClick={isScanning ? stopCamera : startCamera}
              variant={isScanning ? "destructive" : "default"}
            >
              <Camera className="mr-2 h-4 w-4" />
              {isScanning ? "Stop Camera" : "Start Camera"}
            </Button>
          </div>

          <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
            {isScanning ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                No camera active
              </div>
            )}
          </div>

          <canvas ref={canvasRef} className="hidden" />
        </div>
      </Card>
    </div>
  );
}