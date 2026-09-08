"use server";

import { createClient } from "@/lib/supabase/server";
import { generatePatrolRecommendation } from "@/lib/gemini/patrol-recommendation";
import type { ComplaintCategory } from "@/lib/complaints";

export type PatrolRecommendationResult = { recommendation: string | null; error: string | null };

export async function getPatrolRecommendation(
  category: ComplaintCategory,
  location: string,
  complaintIds: string[]
): Promise<PatrolRecommendationResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { recommendation: null, error: "You must be logged in." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "officer") {
    return { recommendation: null, error: "Only officers can request patrol recommendations." };
  }

  const { data: complaints } = await supabase
    .from("complaints")
    .select("incident_datetime")
    .in("id", complaintIds);

  const incidentTimes = (complaints ?? []).map((c) => c.incident_datetime);

  const recommendation = await generatePatrolRecommendation({ category, location, incidentTimes });

  if (!recommendation) {
    return {
      recommendation: null,
      error: "Couldn't generate a recommendation right now. Please try again.",
    };
  }

  return { recommendation, error: null };
}
