import sharp from 'sharp';

export interface ImageQualityMetrics {
  brightness: number;
  contrast: number;
  sharpness: number;
  hasGlare: boolean;
  orientation: number;
  needsRotation: boolean;
}

// Convert File to base64
export function getImageDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Check image quality via backend API
export async function checkImageQuality(file: File): Promise<{
  isValid: boolean;
  message: string;
}> {
  const formData = new FormData();
  formData.append("image", file);

  const response = await fetch("/api/check-quality", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Failed to check image quality: ${await response.text()}`);
  }

  return response.json();
}