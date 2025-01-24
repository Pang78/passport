import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function extractPassportData(base64Image: string) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
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

    const parsedContent = JSON.parse(content);
    const confidenceScores = parsedContent.confidence_scores || {};

    // Calculate overall confidence
    const scores = Object.values(confidenceScores) as number[];
    const overall = scores.length > 0 
      ? scores.reduce((sum, score) => sum + score, 0) / scores.length
      : 0;

    return {
      ...parsedContent,
      overall_confidence: overall
    };
  } catch (error: any) {
    // Return a structured response indicating failure
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
      extraction_notes: [`Failed to process image: ${error.message}`]
    };
  }
}