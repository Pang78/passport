import { useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Camera, Upload } from 'lucide-react';
import { analyzeDocument, type DocumentData } from '@/lib/openai-service';
import { useToast } from '@/hooks/use-toast';

export function DocumentScanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [documentData, setDocumentData] = useState<DocumentData | null>(null);
  const { toast } = useToast();

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
      setDocumentData(null);
      const result = await analyzeDocument(imageData);
      setDocumentData(result);
      stopCamera();
    } catch (error) {
      toast({
        title: "Analysis Failed",
        description: "Failed to analyze the document. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const imageData = e.target?.result as string;
        setDocumentData(null);
        const result = await analyzeDocument(imageData);
        setDocumentData(result);
      } catch (error) {
        toast({
          title: "Analysis Failed",
          description: "Failed to analyze the uploaded document. Please try again.",
          variant: "destructive",
        });
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="w-full max-w-3xl mx-auto p-4">
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex gap-4 justify-center">
            <Button
              onClick={isScanning ? stopCamera : startCamera}
              variant={isScanning ? "destructive" : "default"}
            >
              <Camera className="mr-2 h-4 w-4" />
              {isScanning ? "Stop Camera" : "Start Camera"}
            </Button>
            
            <Button asChild variant="outline">
              <label>
                <Upload className="mr-2 h-4 w-4" />
                Upload Document
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileUpload}
                />
              </label>
            </Button>
          </div>

          <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
            {isScanning ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                <Button
                  onClick={captureImage}
                  className="absolute bottom-4 left-1/2 transform -translate-x-1/2"
                  variant="secondary"
                >
                  Capture
                </Button>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                {documentData ? "Document analyzed" : "No camera active"}
              </div>
            )}
          </div>

          <canvas ref={canvasRef} className="hidden" />

          {documentData && (
            <div className="mt-4 p-4 border rounded-lg">
              <h3 className="text-lg font-semibold mb-2">
                Document Type: {documentData.type}
              </h3>
              <div className="space-y-2">
                {Object.entries(documentData.fields).map(([key, value]) => (
                  <div key={key} className="flex gap-2">
                    <span className="font-medium">{key}:</span>
                    <span>{value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-sm text-gray-500">
                Confidence: {(documentData.confidence * 100).toFixed(1)}%
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
