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
          content: `You are a passport data extraction expert. Analyze the passport image and extract the following fields in JSON format:
          - fullName
          - dateOfBirth (YYYY-MM-DD)
          - passportNumber
          - nationality
          - dateOfIssue (YYYY-MM-DD)
          - dateOfExpiry (YYYY-MM-DD)
          - placeOfBirth
          - issuingAuthority
          - mrz (if present, include line1 and line2)

          Ensure dates are in ISO format and clean any OCR artifacts from the text.`
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
    throw new Error(`Failed to extract passport data: ${error.message}`);
  }
}