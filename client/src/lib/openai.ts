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
          content: `You are a passport data extraction expert. Analyze the passport image and extract data with confidence scores. Even if the image is unclear or unrecognizable, provide your best attempt at extraction and indicate low confidence.

For each field, provide:
- The extracted value
- A confidence score (0-1) indicating how certain you are about the extraction

Return the data in this format:
{
  "data": {
    "fullName": string,
    "dateOfBirth": string (YYYY-MM-DD),
    "passportNumber": string,
    "nationality": string,
    "dateOfIssue": string (YYYY-MM-DD),
    "dateOfExpiry": string (YYYY-MM-DD),
    "placeOfBirth": string,
    "issuingAuthority": string,
    "mrz": {
      "line1": string,
      "line2": string
    }
  },
  "confidence_scores": {
    "fullName": number,
    "dateOfBirth": number,
    "passportNumber": number,
    "nationality": number,
    "dateOfIssue": number,
    "dateOfExpiry": number,
    "placeOfBirth": number,
    "issuingAuthority": number,
    "mrz": number
  },
  "overall_confidence": number,
  "extraction_notes": string[]
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