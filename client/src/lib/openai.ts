import OpenAI from "openai";

// Initialize OpenAI client with error handling
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY,
  maxRetries: 3,
  timeout: 30000,
});

export async function extractPassportData(base64Image: string) {
  console.log("Attempting OpenAI request...");
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
      max_tokens: 1000,
      messages: [
        {
          role: "system",
          content: `You are a passport data extraction expert. Your task is to:
          1. Extract ANY visible text from the passport image, even if partial or unclear
          2. For each field, describe exactly what you can and cannot see
          3. Use confidence scores based on visibility:
             - 1.0: Perfectly clear and complete
             - 0.7: Mostly visible but some parts unclear
             - 0.5: Partially visible or somewhat blurry
             - 0.3: Barely visible or very blurry
             - 0.1: Can see something but can't read it
             - 0.0: Not visible at all
          4. For partial dates, use format YYYY-MM-DD with ? for unknown digits
          5. For partial names or numbers, include what's visible with ? for unclear parts
          6. Add detailed notes about image quality and visibility issues`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Describe EXACTLY what you can see in this passport image, including:\n" +
                    "1. Any visible text or numbers, even if partial\n" +
                    "2. The quality and clarity of each visible element\n" +
                    "3. Specific areas that are unclear or obscured\n" +
                    "4. Whether the image appears to be a valid passport\n\n" +
                    "Return in JSON format with fields: fullName, dateOfBirth, passportNumber, nationality, dateOfIssue, dateOfExpiry, placeOfBirth, issuingAuthority, mrz (line1/line2), confidence_scores, extraction_notes"
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ],
        }
      ],
      temperature: 0,
    });

    console.log("OpenAI response received:", response.choices[0].message.content);
    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No content received from OpenAI");
    }

    try {
      const parsedData = JSON.parse(content);
      return {
        ...parsedData,
        confidence_scores: {
          fullName: parsedData.confidence_scores?.fullName ?? 0,
          dateOfBirth: parsedData.confidence_scores?.dateOfBirth ?? 0,
          passportNumber: parsedData.confidence_scores?.passportNumber ?? 0,
          nationality: parsedData.confidence_scores?.nationality ?? 0,
          dateOfIssue: parsedData.confidence_scores?.dateOfIssue ?? 0,
          dateOfExpiry: parsedData.confidence_scores?.dateOfExpiry ?? 0,
          placeOfBirth: parsedData.confidence_scores?.placeOfBirth ?? 0,
          issuingAuthority: parsedData.confidence_scores?.issuingAuthority ?? 0,
          mrz: parsedData.confidence_scores?.mrz ?? 0
        },
        overall_confidence: parsedData.overall_confidence ?? 
          Object.values(parsedData.confidence_scores || {}).reduce((sum, score) => sum + (score || 0), 0) / 
          Object.keys(parsedData.confidence_scores || {}).length,
        extraction_notes: [
          ...(parsedData.extraction_notes || []),
          ...Object.entries(parsedData.confidence_scores || {})
            .filter(([_, score]) => (score || 0) < 0.3)
            .map(([field]) => `Low confidence in ${field} extraction`)
        ]
      };
    } catch (error) {
      console.error("Failed to parse OpenAI response:", error, "Content:", content);
      throw new Error(`Failed to parse OpenAI response: ${error instanceof Error ? error.message : String(error)}`);
    }
  } catch (error: any) {
    console.error("OpenAI request failed:", error);
    let errorMessage = "Failed to process image";
    let extractionNotes = [];

    if (error.status === 429) {
      errorMessage = "API rate limit exceeded. Please try again in a few minutes.";
      extractionNotes.push("Rate limit reached - temporary service interruption");
    } else if (error.status === 401) {
      errorMessage = "Authentication error with AI service";
      extractionNotes.push("API authentication failed");
    } else if (error.name === "AbortError") {
      errorMessage = "Request timed out. Please try again.";
      extractionNotes.push("Processing timeout - possible network issues");
    } else if (error.message.includes("JSON")) {
      errorMessage = "Invalid response format from AI service";
      extractionNotes.push("Data parsing error - unexpected response format");
    }

    return {
      fullName: "Unknown",
      dateOfBirth: "",
      passportNumber: "",
      nationality: "",
      dateOfIssue: "",
      dateOfExpiry: "",
      placeOfBirth: "",
      issuingAuthority: "",
      mrz: {
        line1: "",
        line2: ""
      },
      confidence_scores: {
        fullName: 0,
        dateOfBirth: 0,
        passportNumber: 0,
        nationality: 0,
        dateOfIssue: 0,
        dateOfExpiry: 0,
        placeOfBirth: 0,
        issuingAuthority: 0,
        mrz: 0
      },
      overall_confidence: 0,
      extraction_notes: [errorMessage, ...extractionNotes]
    };
  }
}