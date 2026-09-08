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

  // .update().eq() alone would report success even if RLS silently matched
  // zero rows (Supabase's client only errors on a query failure, not on an
  // update that quietly affected nothing) -- chaining .select().single()
  // forces the row back and turns "nothing was actually updated" into a
  // real, visible error instead of a false "it worked."
  const { data, error } = await supabase
    .from("sos_alerts")
    .update({ status: "resolved" })
    .eq("id", alertId)
    .select("id, status")
    .single();

  if (error || !data) {
    console.error(`[resolveSosAlert] Failed to resolve alert ${alertId}:`, error);
    return { error: "Failed to resolve alert." };
  }

  if (data.status !== "resolved") {
    console.error(
      `[resolveSosAlert] Update for alert ${alertId} returned status "${data.status}", expected "resolved".`
    );
    return { error: "Failed to resolve alert." };
  }

  return { error: null };
}
