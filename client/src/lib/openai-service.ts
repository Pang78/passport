import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

export interface DocumentData {
  type: string;
  fields: Record<string, string>;
  confidence: number;
}

export async function analyzeDocument(imageData: string): Promise<DocumentData> {
  try {
    // Convert base64 to blob
    const response = await fetch(imageData);
    const blob = await response.blob();

    // Create FormData and append the image
    const formData = new FormData();
    formData.append('image', blob);

    // Send to our backend API
    const apiResponse = await fetch('/api/analyze-document', {
      method: 'POST',
      body: formData,
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      throw new Error(`API error: ${errorText}`);
    }

    const result = await apiResponse.json();
    return {
      type: result.type || 'unknown',
      fields: result.fields || {},
      confidence: result.confidence || 0
    };
  } catch (error) {
    console.error('Document analysis failed:', error);
    throw new Error('Failed to analyze document');
  }
}