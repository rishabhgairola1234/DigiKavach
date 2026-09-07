import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ComplaintStatus, ExtractedComplaintData } from "@/lib/complaints";
import { COMPLAINT_STATUS_LABEL, CATEGORY_LABEL, PRIORITY_LABEL } from "@/lib/complaints";

export type CaseContext = {
  title: string;
  description: string;
  status: ComplaintStatus;
  extractedData: ExtractedComplaintData | null;
};

const SYSTEM_INSTRUCTION = `You are the Investigation Copilot on a police case management platform.
An officer will ask you questions about ONE specific case. You are given that case's full data below
each question. Answer using ONLY that data -- never invent people, vehicles, locations, times, or facts
that aren't present in it. If the case data doesn't contain enough information to answer, say so plainly
instead of guessing. Keep answers concise and directly useful to an investigator.`;

function formatCaseContext(context: CaseContext): string {
  const lines = [
    `Title: ${context.title}`,
    `Status: ${COMPLAINT_STATUS_LABEL[context.status]}`,
    `Description: ${context.description}`,
  ];

  if (!context.extractedData) {
    lines.push("", "No AI-extracted structured data is available for this case.");
    return lines.join("\n");
  }

  const { extractedData } = context;
  lines.push(
    "",
    `Category: ${CATEGORY_LABEL[extractedData.category]}`,
    `Priority: ${PRIORITY_LABEL[extractedData.priority]}`,
    "",
    "People mentioned:",
    extractedData.people.length
      ? extractedData.people
          .map((p) => `- ${p.name ?? "Unnamed"}: ${p.description}`)
          .join("\n")
      : "- None mentioned",
    "",
    "Vehicles mentioned:",
    extractedData.vehicles.length
      ? extractedData.vehicles
          .map((v) => `- ${v.type}${v.plate_number ? ` (plate ${v.plate_number})` : ""}`)
          .join("\n")
      : "- None mentioned",
    "",
    "Other locations mentioned:",
    extractedData.locations.length
      ? extractedData.locations.map((l) => `- ${l}`).join("\n")
      : "- None mentioned",
    "",
    "Other times mentioned:",
    extractedData.times.length
      ? extractedData.times.map((t) => `- ${t}`).join("\n")
      : "- None mentioned"
  );

  return lines.join("\n");
}

/**
 * Answers one officer question about one case, grounded only in that case's data.
 * Returns null on any failure (missing key, network error) -- callers must show a
 * clear error rather than crash, this must never take down the case page.
 */
export async function askCaseCopilot(
  context: CaseContext,
  question: string
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[askCaseCopilot] GEMINI_API_KEY is not set — skipping.");
    return null;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-3.6-flash",
      systemInstruction: SYSTEM_INSTRUCTION,
    });

    const prompt = `CASE DATA\n${formatCaseContext(context)}\n\nOFFICER QUESTION: ${question}`;
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (err) {
    console.error("[askCaseCopilot] Gemini call failed:", err);
    return null;
  }
}
