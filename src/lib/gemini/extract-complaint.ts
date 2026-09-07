import { GoogleGenerativeAI, SchemaType, type Schema } from "@google/generative-ai";
import type { ComplaintCategory, ComplaintPriority, ExtractedComplaintData } from "@/lib/complaints";

const CATEGORIES: ComplaintCategory[] = [
  "theft",
  "assault",
  "cybercrime",
  "harassment",
  "property_damage",
  "other",
];

const PRIORITIES: ComplaintPriority[] = ["low", "medium", "high"];

const extractionSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    people: {
      type: SchemaType.ARRAY,
      description: "Every person mentioned in the complaint, other than the complainant themself.",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: {
            type: SchemaType.STRING,
            nullable: true,
            description: "The person's name, if given.",
          },
          description: {
            type: SchemaType.STRING,
            description: "How this person relates to the incident (e.g. 'suspect', 'witness').",
          },
        },
        required: ["description"],
      },
    },
    vehicles: {
      type: SchemaType.ARRAY,
      description: "Every vehicle mentioned in the complaint.",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          type: {
            type: SchemaType.STRING,
            description: "e.g. 'car', 'motorcycle', 'auto-rickshaw'.",
          },
          plate_number: {
            type: SchemaType.STRING,
            nullable: true,
            description: "License plate number, if mentioned.",
          },
        },
        required: ["type"],
      },
    },
    locations: {
      type: SchemaType.ARRAY,
      description: "Every place mentioned in the complaint, besides the primary incident location.",
      items: { type: SchemaType.STRING },
    },
    times: {
      type: SchemaType.ARRAY,
      description: "Every date/time reference mentioned besides the primary incident date/time.",
      items: { type: SchemaType.STRING },
    },
    category: {
      type: SchemaType.STRING,
      format: "enum",
      enum: CATEGORIES,
      description: "The single best-fitting category for this complaint.",
    },
    priority: {
      type: SchemaType.STRING,
      format: "enum",
      enum: PRIORITIES,
      description: "Urgency implied by the description — e.g. ongoing danger or violence is high.",
    },
  },
  required: ["people", "vehicles", "locations", "times", "category", "priority"],
};

const SYSTEM_INSTRUCTION = `You are a case intelligence assistant for a police complaint platform.
Read the complaint title and description and extract structured data for investigators.
Only include people, vehicles, locations, and times that are explicitly mentioned in the text —
never invent details. Respond with JSON matching the given schema only.`;

/**
 * Calls Gemini to extract structured case data from a complaint. Returns null on any
 * failure (missing key, network error, malformed response) — callers must treat this as
 * "no extraction available" and must never let it block saving the complaint.
 */
export async function extractComplaintData(
  title: string,
  description: string
): Promise<ExtractedComplaintData | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[extractComplaintData] GEMINI_API_KEY is not set — skipping AI extraction.");
    return null;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-3.6-flash",
      systemInstruction: SYSTEM_INSTRUCTION,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: extractionSchema,
      },
    });

    const result = await model.generateContent(
      `Complaint title: ${title}\n\nComplaint description: ${description}`
    );

    const raw = result.response.text();
    const parsed = JSON.parse(raw) as ExtractedComplaintData;
    return parsed;
  } catch (err) {
    console.error("[extractComplaintData] Gemini extraction failed:", err);
    return null;
  }
}
