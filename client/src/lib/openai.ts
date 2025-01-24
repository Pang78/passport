import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function extractPassportData(base64Image: string) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a passport data extraction expert. First validate if the image shows a valid passport document. If it's not a passport, respond with {"isValid": false, "error": "reason"}. If it is a passport, extract and return the following fields:
          - fullName
          - dateOfBirth (YYYY-MM-DD)
          - passportNumber
          - nationality
          - dateOfIssue (YYYY-MM-DD)
          - dateOfExpiry (YYYY-MM-DD)
          - placeOfBirth
          - issuingAuthority
          - mrz (if present, include line1 and line2)

          Return data as {"isValid": true, ...extracted_fields}`
        },
        {
          role: "user",
          content: [
            {
              type: "text", 
              text: "Extract data from this passport image."
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

    const result = JSON.parse(content);
    if (!result.isValid) {
      throw new Error(result.error || "Invalid passport image");
    }

    delete result.isValid;
    return result;
  } catch (error: any) {
    throw new Error(`Failed to extract passport data: ${error.message}`);
  }
}