import { GoogleGenerativeAI } from "@google/generative-ai";
import { CATEGORY_LABEL, type ComplaintCategory, type ExtractedComplaintData } from "@/lib/complaints";

export type FirContext = {
  title: string;
  description: string;
  incidentDatetime: string;
  location: string;
  category: ComplaintCategory | null;
  extractedData: ExtractedComplaintData | null;
  complainantName: string;
  complainantContact: string;
  investigatingOfficer: string;
};

const SYSTEM_INSTRUCTION = `You are an assistant drafting a First Information Report (FIR) for an Indian
police station, in the standard FIR structure. Use ONLY the case data provided -- never invent a
complainant's address, phone number, ID number, or any fact not given to you. Where a standard FIR field
has no data available, write "[Not recorded]" instead of guessing. Write in a formal, neutral
police-report tone. Output plain text only (no markdown formatting, no asterisks) with clear, numbered,
ALL-CAPS section headers, structured exactly as:

1. COMPLAINANT DETAILS
2. DATE, TIME AND PLACE OF OCCURRENCE
3. DETAILS OF THE OFFENSE
4. PERSONS INVOLVED
5. PROPERTY / VEHICLES INVOLVED
6. NARRATIVE SUMMARY

This is a draft for officer review before official filing, not a final legal document.`;

function formatFirContext(context: FirContext): string {
  const lines = [
    `Complainant name: ${context.complainantName}`,
    `Complainant contact: ${context.complainantContact}`,
    `Investigating officer: ${context.investigatingOfficer}`,
    `Complaint title: ${context.title}`,
    `Category: ${context.category ? CATEGORY_LABEL[context.category] : "Unclassified"}`,
    `Incident date/time: ${new Date(context.incidentDatetime).toLocaleString("en-IN", {
      dateStyle: "long",
      timeStyle: "short",
    })}`,
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
        : "- None recorded",
      "",
      "Vehicles mentioned:",
      vehicles.length
        ? vehicles
            .map((v) => `- ${v.type}${v.plate_number ? ` (plate ${v.plate_number})` : ""}`)
            .join("\n")
        : "- None recorded",
      "",
      "Other locations mentioned:",
      locations.length ? locations.map((l) => `- ${l}`).join("\n") : "- None recorded",
      "",
      "Other times mentioned:",
      times.length ? times.map((t) => `- ${t}`).join("\n") : "- None recorded"
    );
  } else {
    lines.push("", "No AI-extracted structured data is available for this case.");
  }

  return lines.join("\n");
}

/**
 * Drafts an FIR from one case's recorded data. Returns null on any failure
 * (missing key, network error) -- callers must show a clear error rather than
 * crash, and must never treat this as anything more than an editable draft.
 */
export async function generateFirDraft(context: FirContext): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[generateFirDraft] GEMINI_API_KEY is not set — skipping.");
    return null;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-3.6-flash",
      systemInstruction: SYSTEM_INSTRUCTION,
    });

    const prompt = `CASE DATA\n${formatFirContext(context)}\n\nDraft the FIR now.`;
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (err) {
    console.error("[generateFirDraft] Gemini call failed:", err);
    return null;
  }
}
