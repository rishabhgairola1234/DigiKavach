"use server";

import { createClient } from "@/lib/supabase/server";
import { runChatIntakeTurn, type ChatMessage, type ChatIntakeSummary } from "@/lib/gemini/chat-intake";

export type ChatTurnResult = {
  assistantMessage: string | null;
  readyToSummarize: boolean;
  summary: ChatIntakeSummary | null;
  error: string | null;
};

export async function chatComplaintTurn(history: ChatMessage[]): Promise<ChatTurnResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      assistantMessage: null,
      readyToSummarize: false,
      summary: null,
      error: "You must be logged in.",
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "civilian") {
    return {
      assistantMessage: null,
      readyToSummarize: false,
      summary: null,
      error: "Only civilian accounts can file complaints.",
    };
  }

  const result = await runChatIntakeTurn(history);

  if (!result) {
    return {
      assistantMessage: null,
      readyToSummarize: false,
      summary: null,
      error: "Something went wrong. Please try again, or switch to the regular form.",
    };
  }

  return {
    assistantMessage: result.assistantMessage,
    readyToSummarize: result.readyToSummarize,
    summary: result.summary,
    error: null,
  };
}
