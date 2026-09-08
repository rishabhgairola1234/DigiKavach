import { GoogleGenerativeAI, SchemaType, type Schema } from "@google/generative-ai";
import { CATEGORY_LABEL, type ComplaintCategory, type ExtractedComplaintData } from "@/lib/complaints";

export type SuggestedLegalSection = {
  section: string;
  title: string;
  reason: string;
};

const legalSectionsSchema: Schema = {
  type: SchemaType.ARRAY,
  description: "1 to 3 of the most relevant applicable legal sections, most relevant first.",
  items: {
    type: SchemaType.OBJECT,
    properties: {
      section: {
        type: SchemaType.STRING,
        description:
          "Exactly in the form 'BNS Section <number>' or 'IPC Section <number>' -- no other wording, no year, no spelled-out act name. Prefer BNS; use IPC only if you are not confident of the BNS mapping.",
      },
      title: {
        type: SchemaType.STRING,
        description: "A short title for the offense this section covers, e.g. 'Theft'.",
      },
      reason: {
        type: SchemaType.STRING,
        description: "One sentence explaining why this section applies to this specific case.",
      },
    },
    required: ["section", "title", "reason"],
  },
};

const SYSTEM_INSTRUCTION = `You suggest likely applicable Indian criminal law sections for a police case,
as a reference starting point for the investigating officer -- this is not a legal determination. Prefer
sections from the Bharatiya Nyaya Sanhita (BNS), the code that replaced the Indian Penal Code (IPC) in
2024. Cite an IPC section instead only if you are not confident of the correct BNS mapping. Suggest 1 to 3
of the MOST relevant sections based on the case's category, description, and extracted details -- do not
pad the list with weak or generic matches. Always format the "section" field exactly as "BNS Section
<number>" or "IPC Section <number>" -- nothing else, no act name, no year. Respond with JSON matching the
given schema only.`;

function formatContext(
  category: ComplaintCategory | null,
  description: string,
  extractedData: ExtractedComplaintData | null
): string {
  const lines = [
    `Category: ${category ? CATEGORY_LABEL[category] : "Unclassified"}`,
    `Description: ${description}`,
  ];

  if (extractedData) {
    const { people, vehicles } = extractedData;
    if (people.length) {
      lines.push("", "People involved:", people.map((p) => `- ${p.description}`).join("\n"));
    }
    if (vehicles.length) {
      lines.push("", "Vehicles involved:", vehicles.map((v) => `- ${v.type}`).join("\n"));
    }
  }

  return lines.join("\n");
}

/**
 * Suggests applicable BNS/IPC sections for one case. Returns null on any
 * failure -- this is a supplementary aid, not core functionality, so callers
 * must fail silently (just don't render the section) rather than show an error.
 */
export async function suggestLegalSections(
  category: ComplaintCategory | null,
  description: string,
  extractedData: ExtractedComplaintData | null
): Promise<SuggestedLegalSection[] | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[suggestLegalSections] GEMINI_API_KEY is not set — skipping.");
    return null;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-3.6-flash",
      systemInstruction: SYSTEM_INSTRUCTION,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: legalSectionsSchema,
      },
    });

    const result = await model.generateContent(formatContext(category, description, extractedData));
    const parsed = JSON.parse(result.response.text()) as SuggestedLegalSection[];
    return parsed.length ? parsed : null;
  } catch (err) {
    console.error("[suggestLegalSections] Gemini call failed:", err);
    return null;
  }
}
