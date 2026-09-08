import { GoogleGenerativeAI } from "@google/generative-ai";
import { CATEGORY_LABEL, type ComplaintCategory } from "@/lib/complaints";

export type PatrolRecommendationContext = {
  category: ComplaintCategory;
  location: string;
  incidentTimes: string[]; // ISO datetimes, one per complaint in the cluster
};

const SYSTEM_INSTRUCTION = `You write a single, concrete patrol recommendation for police officers based on a
detected cluster of similar complaints -- never invent facts not given to you. Ground it strictly in the
actual category, location, and incident times given: if the times show a genuine pattern (e.g. mostly
evenings, mostly weekends), mention it; if they don't show a clear pattern, just recommend increased presence
near the location without inventing a time window. Write exactly ONE sentence, plain text, no markdown, in a
style like "Consider increased patrol presence near [location] during [time pattern], given the recent
clustering of [category] complaints."`;

function formatContext(context: PatrolRecommendationContext): string {
  const times = context.incidentTimes
    .map((t) =>
      new Date(t).toLocaleString("en-IN", {
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    )
    .join("; ");

  return [
    `Category: ${CATEGORY_LABEL[context.category]}`,
    `Location: ${context.location}`,
    `Incident times: ${times}`,
  ].join("\n");
}

/**
 * One-line patrol recommendation for a detected trend cluster. Manually
 * triggered from the Trend Alert banner, so a failure must be surfaced, not
 * swallowed. Returns null on any failure.
 */
export async function generatePatrolRecommendation(
  context: PatrolRecommendationContext
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[generatePatrolRecommendation] GEMINI_API_KEY is not set.");
    return null;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-3.6-flash",
      systemInstruction: SYSTEM_INSTRUCTION,
    });

    const prompt = `CLUSTER DATA\n${formatContext(context)}\n\nWrite the recommendation now.`;
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (err) {
    console.error("[generatePatrolRecommendation] Gemini call failed:", err);
    return null;
  }
}
