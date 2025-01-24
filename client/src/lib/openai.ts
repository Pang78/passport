import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function extractPassportData(base64Image: string) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a passport data extraction expert. Your task is to analyze passport images and return a JSON object containing the extracted data. Even if the image is unclear, provide your best attempt at extraction with appropriate confidence scores.

You must respond with a valid JSON object containing:
{
  "data": {
    "fullName": string,       // Full name from passport
    "dateOfBirth": string,    // Format: YYYY-MM-DD
    "passportNumber": string, // Passport number
    "nationality": string,    // Country of nationality
    "dateOfIssue": string,    // Format: YYYY-MM-DD
    "dateOfExpiry": string,   // Format: YYYY-MM-DD
    "placeOfBirth": string,   // Place of birth
    "issuingAuthority": string, // Authority that issued passport
    "mrz": {
      "line1": string,        // First MRZ line
      "line2": string         // Second MRZ line
    }
  },
  "confidence_scores": {
    "fullName": number,       // 0-1 confidence score
    "dateOfBirth": number,    // 0-1 confidence score
    "passportNumber": number, // 0-1 confidence score
    "nationality": number,    // 0-1 confidence score
    "dateOfIssue": number,    // 0-1 confidence score
    "dateOfExpiry": number,   // 0-1 confidence score
    "placeOfBirth": number,   // 0-1 confidence score
    "issuingAuthority": number, // 0-1 confidence score
    "mrz": number            // 0-1 confidence score
  },
  "overall_confidence": number, // 0-1 overall confidence
  "extraction_notes": string[]  // Array of notes/warnings
}`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract the passport data from this image."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ],
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No content received from OpenAI");
    }

    return JSON.parse(content);
  } catch (error: any) {
    // Instead of throwing an error, return a structured response indicating failure
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
      extraction_notes: [`Failed to process image: ${error.message}`]
    };
  }
}