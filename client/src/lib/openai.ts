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
      max_tokens: 4096,
      messages: [
        {
          role: "system",
          content: `You are a passport data extraction expert. Extract data from passport images and return it in a specific JSON format with confidence scores.
          Follow these rules:
          1. Dates should be in YYYY-MM-DD format
          2. Names should be in UPPERCASE as shown in passport
          3. Passport numbers should preserve exact formatting
          4. Include confidence scores between 0-1 for each field
          5. If a field is not clearly visible, use a lower confidence score
          6. MRZ lines should maintain exact format and spacing`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract the following data from this passport image and format as JSON:\n" +
                    "- fullName (as shown in passport)\n" +
                    "- dateOfBirth (YYYY-MM-DD)\n" +
                    "- passportNumber (exact format)\n" +
                    "- nationality\n" +
                    "- dateOfIssue (YYYY-MM-DD)\n" +
                    "- dateOfExpiry (YYYY-MM-DD)\n" +
                    "- placeOfBirth\n" +
                    "- issuingAuthority\n" +
                    "- mrz (machine readable zone) with line1 and line2\n\n" +
                    "Include confidence_scores (0-1) for each field and overall_confidence."
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

    console.log("OpenAI response received:", response.choices[0]);
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
        overall_confidence: parsedData.overall_confidence ?? 0,
        extraction_notes: parsedData.extraction_notes ?? []
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