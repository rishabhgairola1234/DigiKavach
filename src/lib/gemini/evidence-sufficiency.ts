import { GoogleGenerativeAI, SchemaType, type Schema } from "@google/generative-ai";
import { CATEGORY_LABEL, type ComplaintCategory, type ExtractedComplaintData } from "@/lib/complaints";

export type SufficiencyContext = {
  description: string;
  category: ComplaintCategory | null;
  extractedData: ExtractedComplaintData | null;
  evidenceCount: number;
};

const sufficiencySchema: Schema = {
  type: SchemaType.ARRAY,
  description: "A short checklist of concrete gaps in this case's evidence/documentation.",
  items: {
    type: SchemaType.STRING,
    description: "One specific, actionable gap, e.g. 'No vehicle plate number captured.'",
  },
};

const SYSTEM_INSTRUCTION = `You review a police case's recorded data and identify concrete gaps that would
strengthen it -- for the investigating officer's reference only, not a formal case assessment. Base every
item strictly on what is present or absent in the data given to you -- never invent facts. Good examples:
"No vehicle plate number captured", "No witness contact information recorded", "Only one piece of evidence
uploaded", "Incident time is vague ('sometime in the evening')". List 2 to 6 of the most useful gaps; if the
case is already well-documented, say so with one item instead of padding the list. Respond with JSON
matching the given schema only.`;

function formatContext(context: SufficiencyContext): string {
  const lines = [
    `Category: ${context.category ? CATEGORY_LABEL[context.category] : "Unclassified"}`,
    `Description: ${context.description}`,
    `Evidence files uploaded: ${context.evidenceCount}`,
  ];

  if (context.extractedData) {
    const { people, vehicles, locations, times } = context.extractedData;
    lines.push(
      "",
      `People recorded: ${people.length}`,
      people.length
        ? people.map((p) => `- ${p.name ?? "Unnamed"}: ${p.description}`).join("\n")
        : "- None",
      "",
      `Vehicles recorded: ${vehicles.length}`,
      vehicles.length
        ? vehicles
            .map((v) => `- ${v.type}${v.plate_number ? ` (plate ${v.plate_number})` : " (no plate number given)"}`)
            .join("\n")
        : "- None",
      "",
      `Other locations recorded: ${locations.length}`,
      `Other times recorded: ${times.length}`
    );
  } else {
    lines.push("", "No AI-extracted structured data is available for this case.");
  }

  return lines.join("\n");
}

/**
 * Identifies concrete gaps in a case's recorded evidence/documentation.
 * Manually triggered (button click), so unlike the auto-loading legal
 * sections aid, a failure here must be shown to the officer, not swallowed.
 */
export async function checkEvidenceSufficiency(
  context: SufficiencyContext
): Promise<string[] | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[checkEvidenceSufficiency] GEMINI_API_KEY is not set.");
    return null;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-3.6-flash",
      systemInstruction: SYSTEM_INSTRUCTION,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: sufficiencySchema,
      },
    });

    const result = await model.generateContent(formatContext(context));
    const parsed = JSON.parse(result.response.text()) as string[];
    return parsed;
  } catch (err) {
    console.error("[checkEvidenceSufficiency] Gemini call failed:", err);
    return null;
  }
}
