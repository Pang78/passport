import OpenAI from "openai";

// Initialize OpenAI client with error handling
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY,
  maxRetries: 3, // Add retries for transient failures
  timeout: 30000, // 30 second timeout
});

export async function extractPassportData(base64Image: string) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
      max_tokens: 4096,
      messages: [
        {
          role: "system",
          content: "You are a passport data extraction expert. Analyze the image and return valid JSON data. Include confidence scores (0-1) for each field."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract passport data from this image and respond with a JSON object containing: fullName, dateOfBirth (YYYY-MM-DD), passportNumber, nationality, dateOfIssue (YYYY-MM-DD), dateOfExpiry (YYYY-MM-DD), placeOfBirth, issuingAuthority, and MRZ lines. Include confidence scores between 0 and 1 for each field."
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
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No content received from OpenAI");
    }

    return JSON.parse(content);
  } catch (error: any) {
    // Classify and handle different types of errors
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
      data: {
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
        }
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