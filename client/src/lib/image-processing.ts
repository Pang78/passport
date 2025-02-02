import sharp from 'sharp';

export interface ImageQualityMetrics {
  brightness: number;
  contrast: number;
  sharpness: number;
  hasGlare: boolean;
  orientation: number;
  needsRotation: boolean;
}

// Convert File to base64 with optional compression
export async function getImageDataUrl(file: File, maxSizeKB = 500): Promise<string> {
  try {
    // First convert to base64
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    // If the file is smaller than maxSizeKB, return it as is
    if (file.size <= maxSizeKB * 1024) {
      return base64;
    }

    // Otherwise, compress the image
    const response = await fetch(base64);
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const compressedBuffer = await sharp(buffer)
      .resize(800, 600, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({
        quality: 80,
        progressive: true,
      })
      .toBuffer();

    return `data:image/jpeg;base64,${compressedBuffer.toString('base64')}`;
  } catch (error) {
    console.error('Error processing image:', error);
    throw new Error('Failed to process image');
  }
}

// Enhanced image quality check
export async function checkImageQuality(file: File): Promise<{
  isValid: boolean;
  message: string;
  issues?: string[];
  metrics?: ImageQualityMetrics;
}> {
  const formData = new FormData();
  formData.append("image", file);

  try {
    const response = await fetch("/api/check-quality", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to check image quality: ${errorText}`);
    }

    const result = await response.json();
    return {
      ...result,
      message: result.message || "Image quality check completed",
      issues: result.issues || [],
      metrics: result.metrics || null,
    };
  } catch (error) {
    console.error('Error checking image quality:', error);
    return {
      isValid: false,
      message: 'Failed to check image quality',
      issues: ['Error processing image quality check'],
    };
  }
}

// Convert base64 to Blob for upload
export function base64ToBlob(base64: string): Blob {
  const parts = base64.split(';base64,');
  const contentType = parts[0].split(':')[1];
  const raw = window.atob(parts[1]);
  const rawLength = raw.length;
  const uInt8Array = new Uint8Array(rawLength);

  for (let i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }

  return new Blob([uInt8Array], { type: contentType });
}

// Calculate image size in KB
export function getImageSizeKB(base64: string): number {
  const base64Length = base64.split(',')[1].length;
  return Math.round((base64Length * 3/4) / 1024);
}

// Check if image needs optimization
export function needsOptimization(file: File, maxSizeKB = 500): boolean {
  return file.size > maxSizeKB * 1024;
}