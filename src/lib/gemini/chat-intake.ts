import { GoogleGenerativeAI, SchemaType, type Schema } from "@google/generative-ai";

export type ChatMessage = { role: "assistant" | "user"; content: string };

export type ChatIntakeSummary = {
  title: string;
  description: string;
  incident_datetime_iso: string;
  location: string;
};

export type ChatIntakeResult = {
  assistantMessage: string;
  readyToSummarize: boolean;
  summary: ChatIntakeSummary | null;
};

const chatIntakeSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    assistant_message: {
      type: SchemaType.STRING,
      description: "Your next natural reply/question to the civilian, 1-3 short sentences.",
    },
    ready_to_summarize: {
      type: SchemaType.BOOLEAN,
      description:
        "True once you have enough for a clear title, description, rough date/time, and location.",
    },
    summary: {
      type: SchemaType.OBJECT,
      nullable: true,
      description: "Only present when ready_to_summarize is true.",
      properties: {
        title: { type: SchemaType.STRING, description: "A short, clear one-line title." },
        description: {
          type: SchemaType.STRING,
          description: "A full narrative description synthesized from the whole conversation.",
        },
        incident_datetime_iso: {
          type: SchemaType.STRING,
          description:
            "Best-guess ISO 8601 datetime for the incident, resolving relative references (e.g. 'yesterday evening') against today's date.",
        },
        location: { type: SchemaType.STRING, description: "Where the incident happened." },
      },
      required: ["title", "description", "incident_datetime_iso", "location"],
    },
  },
  required: ["assistant_message", "ready_to_summarize"],
};

function buildSystemInstruction(): string {
  const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, unambiguous for the model

  return `You are a warm, patient intake assistant helping a civilian describe an incident they want to
report to the police, through natural conversation -- not a rigid form. Ask ONE clear, specific question at
a time about whatever is still missing: what happened, when it happened, where it happened, and any other
useful detail (people involved, vehicles, descriptions) -- follow up naturally based on what they've already
told you, the way a thoughtful human intake officer would, rather than working through a fixed checklist.
Be reassuring and easy to talk to, not clinical or robotic. Keep each message to 1-3 short sentences. Never
ask for information the civilian already gave you, and never invent details they didn't mention.

Today's date is ${today}. Once you have enough for: (1) a clear one-line title, (2) a full narrative
description of what happened, (3) a reasonable best-guess date/time, and (4) a location -- set
ready_to_summarize to true and fill in summary using only what the civilian actually told you. Until then,
leave summary null and keep the conversation going.

Respond with JSON matching the given schema only.`;
}

function formatTranscript(history: ChatMessage[]): string {
  return history
    .map((m) => `${m.role === "assistant" ? "ASSISTANT" : "CIVILIAN"}: ${m.content}`)
    .join("\n");
}

/**
 * One turn of the conversational intake flow. Takes the full transcript so
 * far (including the civilian's latest message) and returns the assistant's
 * next reply, plus a structured summary once enough has been gathered.
 * Returns null on any failure -- the chat UI must show a clear error and
 * offer a way to switch to the regular form, never leave the civilian stuck.
 */
export async function runChatIntakeTurn(history: ChatMessage[]): Promise<ChatIntakeResult | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[runChatIntakeTurn] GEMINI_API_KEY is not set.");
    return null;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-3.6-flash",
      systemInstruction: buildSystemInstruction(),
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: chatIntakeSchema,
      },
    });

    const prompt = `CONVERSATION SO FAR:\n${formatTranscript(history)}\n\nRespond with your next message as the ASSISTANT.`;
    const result = await model.generateContent(prompt);
    const parsed = JSON.parse(result.response.text()) as {
      assistant_message: string;
      ready_to_summarize: boolean;
      summary: ChatIntakeSummary | null;
    };

    return {
      assistantMessage: parsed.assistant_message,
      readyToSummarize: parsed.ready_to_summarize,
      summary: parsed.summary,
    };
  } catch (err) {
    console.error("[runChatIntakeTurn] Gemini call failed:", err);
    return null;
  }
}
