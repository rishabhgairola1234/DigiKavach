import { GoogleGenerativeAI, SchemaType, type Schema } from "@google/generative-ai";
import { CATEGORY_LABEL, type ExtractedComplaintData } from "@/lib/complaints";

export type SearchableCase = {
  id: string;
  title: string;
  extractedData: ExtractedComplaintData | null;
};

export type CaseSearchMatch = { complaintId: string; reason: string };

const searchResultsSchema: Schema = {
  type: SchemaType.ARRAY,
  description: "Cases genuinely relevant to the query, most relevant first. May be empty.",
  items: {
    type: SchemaType.OBJECT,
    properties: {
      complaint_id: {
        type: SchemaType.STRING,
        description: "The exact [id] value from one of the cases listed -- copy it verbatim.",
      },
      reason: {
        type: SchemaType.STRING,
        description: "One short sentence explaining why this specific case matches the query.",
      },
    },
    required: ["complaint_id", "reason"],
  },
};

const SYSTEM_INSTRUCTION = `You help a police officer search across cases using natural language. You are
given a query and a compact summary of every case on the platform. Identify which cases are GENUINELY
relevant to the query's meaning -- not just cases that happen to share a keyword. For example, a query
about "a suspect in a black jacket near metro stations" should match cases whose extracted people/locations
actually fit that description, not every case that merely mentions "jacket" or "metro" in isolation. Only
include cases you're genuinely confident are relevant; it's fine to return fewer results, or none, rather
than padding the list. Never invent facts beyond what's in the summaries. Copy each complaint_id exactly as
given -- never alter or guess an id. Respond with JSON matching the given schema only.`;

function formatCaseSummary(c: SearchableCase): string {
  const parts = [`[${c.id}] "${c.title}"`];

  if (c.extractedData) {
    const { category, priority, people, vehicles, locations } = c.extractedData;
    parts.push(`category: ${CATEGORY_LABEL[category]}`, `priority: ${priority}`);
    if (people.length) {
      parts.push(`people: ${people.map((p) => `${p.name ?? "unnamed"} (${p.description})`).join(", ")}`);
    }
    if (vehicles.length) {
      parts.push(`vehicles: ${vehicles.map((v) => v.type).join(", ")}`);
    }
    if (locations.length) {
      parts.push(`other locations: ${locations.join(", ")}`);
    }
  } else {
    parts.push("(no AI-extracted data available)");
  }

  return parts.join(" — ");
}

/**
 * Semantic search across every case's compact summary (title + extracted
 * entities, never the full description, to keep the prompt reasonably
 * sized). Manually triggered, so a failure must be shown to the officer.
 */
export async function searchCases(
  query: string,
  cases: SearchableCase[]
): Promise<CaseSearchMatch[] | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[searchCases] GEMINI_API_KEY is not set.");
    return null;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-3.6-flash",
      systemInstruction: SYSTEM_INSTRUCTION,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: searchResultsSchema,
      },
    });

    const caseList = cases.map(formatCaseSummary).join("\n");
    const prompt = `QUERY: ${query}\n\nCASES:\n${caseList}`;

    const result = await model.generateContent(prompt);
    const parsed = JSON.parse(result.response.text()) as {
      complaint_id: string;
      reason: string;
    }[];

    return parsed.map((r) => ({ complaintId: r.complaint_id, reason: r.reason }));
  } catch (err) {
    console.error("[searchCases] Gemini call failed:", err);
    return null;
  }
}
