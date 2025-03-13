// api/openai.js - Server-side version of the OpenAI utility
import { OpenAI } from "openai";

// Simple implementation of extractPassportData for server-side use
export async function extractPassportData(base64Image, openaiInstance) {
  const extractionNotes = [];
  
  // Use provided OpenAI instance or create one
  const openai = openaiInstance || new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      max_tokens: 4096,
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: `You are a passport OCR system. Analyze the MRZ and visual fields:
          1. Return valid JSON containing passport data
          2. Use ISO dates (YYYY-MM-DD)
          3. Nationality should be 3-letter country code
          4. MRZ lines must follow ICAO 9303 standard
          5. Include confidence scores (0-1) based on clarity
          6. Visual description should note any issues`,
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract passport data from this image:" },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
                detail: "high",
              },
            },
          ],
        },
      ],
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error("Empty response from OpenAI");

    const cleanedContent = content.replace(/```json|```/g, "");
    const parsedData = JSON.parse(cleanedContent);
    
    // Calculate overall confidence
    const confidenceScores = parsedData.confidence_scores || {};
    const confidenceValues = Object.values(confidenceScores);
    const overallConfidence = 
      confidenceValues.length > 0
        ? confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length
        : 0.5;

    // Return normalized data
    return {
      extractedData: parsedData,
      rawText: content,
      overall_confidence: Number(overallConfidence.toFixed(2))
    };
  } catch (error) {
    console.error("OpenAI extraction error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    extractionNotes.push(`Critical error: ${errorMessage}`);

    // Return default/empty data on error
    return {
      extractedData: {
        fullName: "",
        dateOfBirth: "",
        passportNumber: "",
        idNumber: "",
        nationality: "",
        dateOfIssue: "",
        dateOfExpiry: "",
        placeOfBirth: "",
        issuingAuthority: "",
        gender: "",
        mrz: { line1: "", line2: "" },
        confidence_scores: {},
        visual_description: errorMessage
      },
      rawText: errorMessage,
      overall_confidence: 0
    };
  }
} 