import { GoogleGenerativeAI, SchemaType, type Schema } from "@google/generative-ai";

export type SafetyChatMessage = { role: "assistant" | "user"; content: string };

export type SafetyAssistantResult = {
  isImmediateDanger: boolean;
  assistantMessage: string;
};

const safetyAssistantSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    is_immediate_danger: {
      type: SchemaType.BOOLEAN,
      description:
        "True ONLY if the civilian's latest message indicates they are currently, right now, in immediate " +
        "physical danger or an active dangerous situation (e.g. being followed right now, an ongoing assault, " +
        "an immediate threat happening as they type). False for past incidents, hypothetical questions, or " +
        "general safety/procedural questions, even if the topic is serious.",
    },
    assistant_message: {
      type: SchemaType.STRING,
      description:
        "Your reply. If is_immediate_danger is true, this must say ONLY to call 112 immediately and that help " +
        "is on the way if they call -- nothing else. Never include any tactical advice in that case (no " +
        "suggestion to run, hide, fight, confront, or take any other physical action). If is_immediate_danger " +
        "is false, give a genuinely helpful, informative answer to their safety/procedural question.",
    },
  },
  required: ["is_immediate_danger", "assistant_message"],
};

const SYSTEM_INSTRUCTION = `You are the "Safety Assistant" for DigiKavach, a general-purpose safety and
procedural guidance chatbot for civilians in India -- NOT a real-time emergency response tool. You help with
things like: what to do after a theft, how to preserve evidence, rights during a police stop, how to file a
complaint, and general guidance on finding the nearest police station. This is real, genuinely useful safety
and legal information, not tactical decision-making.

HARD SAFETY CONSTRAINT, which overrides everything else: if the civilian's LATEST message suggests they are
currently in immediate physical danger or an active dangerous situation right now -- being followed at this
moment, an assault happening now, an immediate threat -- you must set is_immediate_danger to true and your
assistant_message must say ONLY to call 112 right now, with absolutely no tactical advice about what physical
action to take (never suggest running, hiding, fighting, confronting, or any other in-the-moment action). This
applies no matter how the question is phrased, including if they ask you directly for tactical advice while
describing an active threat. Do not try to be helpful with tactics in that situation -- the only safe answer
is to direct them to call 112 immediately.

For every other message -- past incidents, hypothetical scenarios, or general questions, even about serious
topics -- set is_immediate_danger to false and answer helpfully and informatively in 2-5 short sentences,
plain text, no markdown formatting. You don't have access to a live police-station directory or the
civilian's live location, so for "nearest police station" style questions, give general guidance (e.g. check
Google Maps, dial 100/112, or visit the nearest station) rather than inventing a specific address. Never
invent legal specifics you're not confident about -- keep guidance general and encourage confirming details
with an officer when precision matters.

Respond with JSON matching the given schema only.`;

function formatTranscript(history: SafetyChatMessage[]): string {
  return history
    .map((m) => `${m.role === "assistant" ? "ASSISTANT" : "CIVILIAN"}: ${m.content}`)
    .join("\n");
}

/**
 * One turn of the safety assistant chat. Returns null on any failure -- the
 * chat UI must show a clear error, but the Call 112 button must stay visible
 * and functional regardless, since it never depends on this call succeeding.
 */
export async function runSafetyAssistantTurn(
  history: SafetyChatMessage[]
): Promise<SafetyAssistantResult | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[runSafetyAssistantTurn] GEMINI_API_KEY is not set.");
    return null;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-3.6-flash",
      systemInstruction: SYSTEM_INSTRUCTION,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: safetyAssistantSchema,
      },
    });

    const prompt = `CONVERSATION SO FAR:\n${formatTranscript(history)}\n\nRespond to the civilian's latest message.`;
    const result = await model.generateContent(prompt);
    const parsed = JSON.parse(result.response.text()) as {
      is_immediate_danger: boolean;
      assistant_message: string;
    };

    return {
      isImmediateDanger: parsed.is_immediate_danger,
      assistantMessage: parsed.assistant_message,
    };
  } catch (err) {
    console.error("[runSafetyAssistantTurn] Gemini call failed:", err);
    return null;
  }
}
