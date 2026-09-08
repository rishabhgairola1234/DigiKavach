import { GoogleGenerativeAI, SchemaType, type Schema } from "@google/generative-ai";
import { CATEGORY_LABEL, type ComplaintCategory, type ExtractedComplaintData } from "@/lib/complaints";

export type NextStepsContext = {
  description: string;
  location: string;
  category: ComplaintCategory | null;
  extractedData: ExtractedComplaintData | null;
};

const nextStepsSchema: Schema = {
  type: SchemaType.ARRAY,
  description: "2 to 4 concrete, specific next investigative actions.",
  items: {
    type: SchemaType.STRING,
    description:
      "One specific action grounded in this case's actual details, e.g. naming the real location, person, or vehicle mentioned.",
  },
};

const SYSTEM_INSTRUCTION = `You propose concrete next investigative steps for a police officer working a case,
based strictly on the case data given to you -- for the officer's reference only, not an instruction to
follow blindly. Ground every suggestion in the ACTUAL details present (real location names, real people,
real vehicles/plates) rather than generic advice -- for example "Request CCTV footage from businesses near
[the actual location] for [the actual time window]" or "Attempt to contact [the actual witness name] for a
formal statement" or "Cross-check the vehicle plate [the actual plate] against regional theft databases".
Never invent people, places, or facts not present in the data. Propose 2 to 4 of the most useful, specific
actions -- fewer strong suggestions are better than padding with generic ones. Respond with JSON matching
the given schema only.`;

function formatContext(context: NextStepsContext): string {
  const lines = [
    `Category: ${context.category ? CATEGORY_LABEL[context.category] : "Unclassified"}`,
    `Incident location: ${context.location}`,
    `Description: ${context.description}`,
  ];

  if (context.extractedData) {
    const { people, vehicles, locations, times } = context.extractedData;
    lines.push(
      "",
      "People mentioned:",
      people.length
        ? people.map((p) => `- ${p.name ?? "Unnamed"}: ${p.description}`).join("\n")
        : "- None",
      "",
      "Vehicles mentioned:",
      vehicles.length
        ? vehicles.map((v) => `- ${v.type}${v.plate_number ? ` (plate ${v.plate_number})` : ""}`).join("\n")
        : "- None",
      "",
      "Other locations mentioned:",
      locations.length ? locations.map((l) => `- ${l}`).join("\n") : "- None",
      "",
      "Other times mentioned:",
      times.length ? times.map((t) => `- ${t}`).join("\n") : "- None"
    );
  } else {
    lines.push("", "No AI-extracted structured data is available for this case.");
  }

  return lines.join("\n");
}

/**
 * Proposes concrete next investigative actions for one case. Manually
 * triggered, so a failure here must be shown to the officer, not swallowed
 * (same reasoning as FIR draft / evidence sufficiency).
 */
export async function suggestNextSteps(context: NextStepsContext): Promise<string[] | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[suggestNextSteps] GEMINI_API_KEY is not set.");
    return null;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-3.6-flash",
      systemInstruction: SYSTEM_INSTRUCTION,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: nextStepsSchema,
      },
    });

    const result = await model.generateContent(formatContext(context));
    return JSON.parse(result.response.text()) as string[];
  } catch (err) {
    console.error("[suggestNextSteps] Gemini call failed:", err);
    return null;
  }
}
