import { GoogleGenerativeAI, SchemaType, type Schema } from "@google/generative-ai";

export type TranslationResult =
  | { isEnglish: true }
  | { isEnglish: false; language: string; translatedText: string };

const translationSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    is_english: {
      type: SchemaType.BOOLEAN,
      description: "True if the text is already written in English.",
    },
    language: {
      type: SchemaType.STRING,
      nullable: true,
      description: "The common English name of the detected language (e.g. 'Hindi', 'Tamil'). Null if is_english is true.",
    },
    translated_text: {
      type: SchemaType.STRING,
      nullable: true,
      description: "A complete, accurate English translation. Null if is_english is true.",
    },
  },
  required: ["is_english"],
};

const SYSTEM_INSTRUCTION = `You detect the language of a police complaint description and translate it to
English when needed. Preserve every factual detail exactly as written -- names, numbers, vehicle plate
numbers, dates, and times must never be altered, guessed, or normalized during translation. Respond with
JSON matching the given schema only.`;

/**
 * Detects whether a complaint description is in English, and translates it if not.
 * Returns null on any failure (missing key, network error, malformed response) -- callers
 * must fall back to running extraction on the original text as-is, never block filing.
 */
export async function detectAndTranslateDescription(
  text: string
): Promise<TranslationResult | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[detectAndTranslateDescription] GEMINI_API_KEY is not set — skipping.");
    return null;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-3.6-flash",
      systemInstruction: SYSTEM_INSTRUCTION,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: translationSchema,
      },
    });

    const result = await model.generateContent(text);
    const raw = result.response.text();
    const parsed = JSON.parse(raw) as {
      is_english: boolean;
      language: string | null;
      translated_text: string | null;
    };

    if (parsed.is_english || !parsed.language || !parsed.translated_text) {
      return { isEnglish: true };
    }

    return { isEnglish: false, language: parsed.language, translatedText: parsed.translated_text };
  } catch (err) {
    console.error("[detectAndTranslateDescription] Gemini call failed:", err);
    return null;
  }
}
