"use server";

import { createClient } from "@/lib/supabase/server";
import { runSafetyAssistantTurn, type SafetyChatMessage } from "@/lib/gemini/safety-assistant";

export type SafetyAssistantTurnResult = {
  assistantMessage: string | null;
  isImmediateDanger: boolean;
  error: string | null;
};

export async function safetyAssistantTurn(
  history: SafetyChatMessage[]
): Promise<SafetyAssistantTurnResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { assistantMessage: null, isImmediateDanger: false, error: "You must be logged in." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "civilian") {
    return {
      assistantMessage: null,
      isImmediateDanger: false,
      error: "Only civilian accounts can use the Safety Assistant.",
    };
  }

  const result = await runSafetyAssistantTurn(history);

  if (!result) {
    return {
      assistantMessage: null,
      isImmediateDanger: false,
      error: "The Safety Assistant couldn't respond right now. Please try again.",
    };
  }

  return {
    assistantMessage: result.assistantMessage,
    isImmediateDanger: result.isImmediateDanger,
    error: null,
  };
}
