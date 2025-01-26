import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function extractPassportData(base64Image: string) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 4096,
      messages: [
        {
          role: "system",
          content: "You are a passport data extraction expert. Analyze the image and return valid JSON data. Include confidence scores (0-1) for each field. Also include a 'visual_description' field that describes what you see in the image, including any text you can identify."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract passport data from this image and respond with a JSON object containing: fullName, dateOfBirth (YYYY-MM-DD), passportNumber, idNumber, nationality, dateOfIssue (YYYY-MM-DD), dateOfExpiry (YYYY-MM-DD), placeOfBirth, issuingAuthority, and MRZ lines. Include confidence scores between 0 and 1 for each field."
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

    // Remove any markdown code block syntax if present
    const cleanContent = content.replace(/```json\s*|\s*```/g, '');
    const parsedContent = JSON.parse(cleanContent);
    const confidenceScores = parsedContent.confidence_scores || {};

    // Calculate overall confidence
    const scores = Object.values(confidenceScores) as number[];
    const validScores = scores.filter(score => !isNaN(score) && score !== null);
    const overall = validScores.length > 0 
      ? validScores.reduce((sum, score) => sum + score, 0) / validScores.length
      : 0.8; // Default to 0.8 if no valid confidence scores are present

    return {
      ...parsedContent,
      overall_confidence: overall,
      remarks: parsedContent.visual_description ? [parsedContent.visual_description] : []
    };
  } catch (error: any) {
    // Try to extract any content from OpenAI's response
    const content = error.response?.choices?.[0]?.message?.content;
    
    // If we have content but JSON parsing failed, return it as extraction notes
    if (content) {
      return {
        fullName: "",
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
        extraction_notes: [content]
      };
    }

    // Fallback for other errors
    return {
      fullName: "",
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
      extraction_notes: [`Error: ${error.message}`]
    };
  }
}