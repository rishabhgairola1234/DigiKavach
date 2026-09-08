"use server";

import { createClient } from "@/lib/supabase/server";
import { generateDailyBriefing } from "@/lib/gemini/daily-briefing";
import { isCaseOverdue } from "@/lib/overdue";
import { detectTrends, TREND_LOOKBACK_DAYS, type TrendComplaint } from "@/lib/trend-detection";
import type { ComplaintStatus, ExtractedComplaintData } from "@/lib/complaints";

export type GenerateBriefingResult = { briefing: string | null; error: string | null };

/**
 * Recomputes every aggregate fresh, server-side, rather than trusting
 * whatever the client last rendered -- keeps this consistent with the
 * dashboard's own numbers and avoids serializing large arrays across the
 * client/server boundary just to pass them back in.
 */
export async function generateBriefing(): Promise<GenerateBriefingResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { briefing: null, error: "You must be logged in." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "officer") {
    return { briefing: null, error: "Only officers can generate a briefing." };
  }

  const { data: complaints } = await supabase
    .from("complaints")
    .select("id, title, status, location, extracted_data, created_at");

  const { count: activeSosCount } = await supabase
    .from("sos_alerts")
    .select("*", { count: "exact", head: true })
    .eq("status", "active");

  const rows = complaints ?? [];

  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const newCases = rows
    .filter((c) => new Date(c.created_at).getTime() >= dayAgo)
    .map((c) => ({
      title: c.title,
      category: (c.extracted_data as ExtractedComplaintData | null)?.category ?? null,
    }));

  const overdueCases = rows
    .filter((c) =>
      isCaseOverdue({
        status: c.status as ComplaintStatus,
        extracted_data: c.extracted_data as ExtractedComplaintData | null,
        created_at: c.created_at,
      })
    )
    .map((c) => ({ title: c.title }));

  const lookbackCutoff = Date.now() - TREND_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  const recentForTrends: TrendComplaint[] = rows
    .filter((c) => c.extracted_data && new Date(c.created_at).getTime() >= lookbackCutoff)
    .map((c) => ({
      id: c.id,
      title: c.title,
      category: (c.extracted_data as ExtractedComplaintData).category,
      location: c.location,
      created_at: c.created_at,
    }));
  const trendAlerts = detectTrends(recentForTrends).map((t) => ({
    category: t.category,
    location: t.location,
    count: t.complaints.length,
  }));

  const briefing = await generateDailyBriefing({
    newCases,
    overdueCases,
    activeSosCount: activeSosCount ?? 0,
    trendAlerts,
  });

  if (!briefing) {
    return { briefing: null, error: "Couldn't generate the briefing right now. Please try again." };
  }

  return { briefing, error: null };
}
