import { GoogleGenerativeAI } from "@google/generative-ai";
import { CATEGORY_LABEL, type ComplaintCategory } from "@/lib/complaints";

export type BriefingContext = {
  newCases: { title: string; category: ComplaintCategory | null }[];
  overdueCases: { title: string }[];
  activeSosCount: number;
  trendAlerts: { category: ComplaintCategory; location: string; count: number }[];
};

const SYSTEM_INSTRUCTION = `You write a short daily briefing for a police officer opening their case
dashboard, based strictly on the counts and lists given to you -- never invent cases, numbers, or
details not present in the data. Write it as a short, readable paragraph (2-4 sentences) an officer
could read in about 10 seconds to get oriented, not a re-listing of raw stats or a bulleted report.
Mention what's genuinely worth their attention first (active SOS alerts, overdue cases, emerging
trends), and keep the tone calm and professional -- like a colleague handing off a quick verbal
summary, not an alarmist alert. If everything is quiet, say so briefly rather than padding it out.
Output plain text only, no markdown, no headers.`;

function formatContext(context: BriefingContext): string {
  const lines = [
    `New cases filed in the last 24 hours: ${context.newCases.length}`,
    context.newCases.length
      ? context.newCases
          .map((c) => `- ${c.title} (${c.category ? CATEGORY_LABEL[c.category] : "unclassified"})`)
          .join("\n")
      : "",
    "",
    `Currently overdue cases: ${context.overdueCases.length}`,
    context.overdueCases.length ? context.overdueCases.map((c) => `- ${c.title}`).join("\n") : "",
    "",
    `Active SOS alerts: ${context.activeSosCount}`,
    "",
    `Active trend alerts (clusters of similar cases in one area): ${context.trendAlerts.length}`,
    context.trendAlerts.length
      ? context.trendAlerts
          .map((t) => `- ${t.count}x ${CATEGORY_LABEL[t.category]} near ${t.location}`)
          .join("\n")
      : "",
  ];

  return lines.filter((l) => l !== "").join("\n");
}

/**
 * Writes a short prose orientation briefing from aggregate dashboard data
 * already computed server-side. Manually triggered by the officer, so a
 * failure here must be surfaced, not swallowed.
 */
export async function generateDailyBriefing(context: BriefingContext): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[generateDailyBriefing] GEMINI_API_KEY is not set.");
    return null;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-3.6-flash",
      systemInstruction: SYSTEM_INSTRUCTION,
    });

    const prompt = `TODAY'S DASHBOARD DATA\n${formatContext(context)}\n\nWrite the briefing now.`;
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (err) {
    console.error("[generateDailyBriefing] Gemini call failed:", err);
    return null;
  }
}
