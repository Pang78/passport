import { OpenAI } from "openai";
import { z } from "zod";

// Type definitions
const PassportSchema = z.object({
  fullName: z.string(),
  dateOfBirth: z.string().regex(/\d{4}-\d{2}-\d{2}/),
  passportNumber: z.string(),
  nationality: z.string().length(3),
  dateOfIssue: z.string().regex(/\d{4}-\d{2}-\d{2}/),
  dateOfExpiry: z.string().regex(/\d{4}-\d{2}-\d{2}/),
  placeOfBirth: z.string(),
  issuingAuthority: z.string(),
  mrz: z.object({
    line1: z.string().length(44).or(z.string().length(36)),
    line2: z.string().length(44).or(z.string().length(36)),
  }),
  confidence_scores: z.object({
    fullName: z.number().min(0).max(1),
    dateOfBirth: z.number().min(0).max(1),
    passportNumber: z.number().min(0).max(1),
    nationality: z.number().min(0).max(1),
    dateOfIssue: z.number().min(0).max(1),
    dateOfExpiry: z.number().min(0).max(1),
    placeOfBirth: z.number().min(0).max(1),
    issuingAuthority: z.number().min(0).max(1),
    mrz: z.number().min(0).max(1),
  }),
  visual_description: z.string(),
});

type PassportData = z.infer<typeof PassportSchema> & {
  overall_confidence: number;
  extraction_notes: string[];
};

const DEFAULT_RESPONSE: Omit<PassportData, "extraction_notes"> = {
  fullName: "",
  dateOfBirth: "",
  passportNumber: "",
  nationality: "",
  dateOfIssue: "",
  dateOfExpiry: "",
  placeOfBirth: "",
  issuingAuthority: "",
  mrz: { line1: "", line2: "" },
  confidence_scores: {
    fullName: 0,
    dateOfBirth: 0,
    passportNumber: 0,
    nationality: 0,
    dateOfIssue: 0,
    dateOfExpiry: 0,
    placeOfBirth: 0,
    issuingAuthority: 0,
    mrz: 0,
  },
  overall_confidence: 0,
  visual_description: "",
};

export async function extractPassportData(
  base64Image: string,
): Promise<PassportData> {
  const extractionNotes: string[] = [];

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      max_tokens: 4096,
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: `You are a passport OCR system. Analyze the MRZ and visual fields:
          1. Return valid JSON matching this schema: ${JSON.stringify(PassportSchema.shape)}
          2. Use ISO dates (YYYY-MM-DD)
          3. Nationality should be 3-letter country code
          4. MRZ lines must follow ICAO 9303 standard
          5. Confidence scores (0-1) based on clarity
          6. Visual description should note any issues`,
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract passport data from this image:" },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
                detail: "high",
              },
            },
          ],
        },
      ],
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error("Empty response from OpenAI");

    const cleanedContent = content.replace(/```json|```/g, "");
    const parsedData = JSON.parse(cleanedContent);
    const validation = PassportSchema.safeParse(parsedData);

    if (!validation.success) {
      extractionNotes.push(`Validation errors: ${validation.error.message}`);
    }

    const validData = validation.success ? validation.data : parsedData;
    const confidenceValues = Object.values(validData.confidence_scores);
    const overallConfidence =
      confidenceValues.length > 0
        ? confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length
        : 0.5;

    return {
      ...validData,
      overall_confidence: Number(overallConfidence.toFixed(2)),
      extraction_notes: extractionNotes,
      visual_description:
        validData.visual_description || "No visual description provided",
    };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    extractionNotes.push(`Critical error: ${errorMessage}`);

    return {
      ...DEFAULT_RESPONSE,
      extraction_notes: extractionNotes,
      visual_description: errorMessage,
    };
  }
}
