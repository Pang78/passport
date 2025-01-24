import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY is not set in environment variables");
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function extractPassportData(base64Image: string) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
      max_tokens: 4096,
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `You are a passport data extraction expert. Analyze the image and return structured JSON data.
                   Include confidence scores (0-1) for each field and detailed extraction notes for any potential issues.
                   Pay special attention to:
                   - Proper date formats (YYYY-MM-DD)
                   - Correct MRZ formatting
                   - Character case sensitivity
                   - Special characters in names`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract passport data from this image and respond with a JSON object containing detailed field information and confidence scores."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ]
        }
      ]
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No content received from OpenAI");
    }

    // Clean up the content
    const cleanContent = content.replace(/```json\s*|\s*```/g, '');
    const parsedData = JSON.parse(cleanContent);

    // Calculate overall confidence
    if (parsedData.confidence_scores) {
      const scores = Object.values(parsedData.confidence_scores);
      parsedData.overall_confidence = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    }

    // Add extraction notes for low confidence fields
    parsedData.extraction_notes = parsedData.extraction_notes || [];
    if (parsedData.confidence_scores) {
      Object.entries(parsedData.confidence_scores).forEach(([field, score]) => {
        if (score < 0.6) {
          parsedData.extraction_notes.push(
            `Low confidence in ${field} field (${(score * 100).toFixed(1)}% confidence)`
          );
        }
      });
    }

    return parsedData;
  } catch (error: any) {
    console.error("Error extracting passport data:", error);

    // Return a structured error response
    return {
      fullName: { value: "Unknown", confidence: 0 },
      dateOfBirth: { value: "", confidence: 0 },
      passportNumber: { value: "", confidence: 0 },
      nationality: { value: "", confidence: 0 },
      dateOfIssue: { value: "", confidence: 0 },
      dateOfExpiry: { value: "", confidence: 0 },
      placeOfBirth: { value: "", confidence: 0 },
      issuingAuthority: { value: "", confidence: 0 },
      mrz: {
        line1: { value: "", confidence: 0 },
        line2: { value: "", confidence: 0 }
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