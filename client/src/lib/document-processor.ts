import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: import.meta.env.VITE_OPENAI_API_KEY });

export interface DocumentData {
  type: string;
  fields: Record<string, any>; // Changed from Record<string, string> to allow nested objects
  confidence: number;
}

export async function processDocument(imageBase64: string): Promise<DocumentData> {
  // Remove the data URL prefix if present
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a document analysis expert. Analyze the provided image and extract relevant information. 
          Identify the document type (passport, ID card, driver's license, etc.) and extract all visible text fields.
          For QR codes or barcodes, indicate their presence and any decoded information if visible.
          Format the response as JSON with the following structure:
          {
            "type": "document type",
            "fields": {key-value pairs of extracted information},
            "confidence": number between 0 and 1
          }`
        },
        {
          role: "user",
          content: [
            { 
              type: "text",
              text: "Please analyze this document and extract all relevant information."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Data}`
              }
            }
          ],
        }
      ],
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No content in response");
    }

    const result = JSON.parse(content);
    return result as DocumentData;
  } catch (error) {
    console.error("Error processing document:", error);
    throw new Error("Failed to process document");
  }
}