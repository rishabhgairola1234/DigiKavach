"use server";

import { createClient } from "@/lib/supabase/server";

export type ResolveSosResult = { error: string | null };

export async function resolveSosAlert(alertId: string): Promise<ResolveSosResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "officer") {
    return { error: "Only officers can resolve SOS alerts." };
  }

  const { error } = await supabase
    .from("sos_alerts")
    .update({ status: "resolved" })
    .eq("id", alertId);

  if (error) {
    console.error(`[resolveSosAlert] Failed to resolve alert ${alertId}:`, error);
    return { error: "Failed to resolve alert." };
  }

  return { error: null };
}
