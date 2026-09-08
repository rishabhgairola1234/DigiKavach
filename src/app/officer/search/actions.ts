"use server";

import { createClient } from "@/lib/supabase/server";
import { searchCases, type CaseSearchMatch, type SearchableCase } from "@/lib/gemini/case-search";
import type { ExtractedComplaintData } from "@/lib/complaints";

export type CaseSearchResult = CaseSearchMatch & { title: string };

export type SearchCasesResult = { results: CaseSearchResult[] | null; error: string | null };

export async function searchCasesByQuery(query: string): Promise<SearchCasesResult> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return { results: null, error: "Enter a search query first." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { results: null, error: "You must be logged in." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "officer") {
    return { results: null, error: "Only officers can search cases." };
  }

  const { data: complaints } = await supabase
    .from("complaints")
    .select("id, title, extracted_data");

  if (!complaints || complaints.length === 0) {
    return { results: null, error: "There are no cases to search yet." };
  }

  const searchable: SearchableCase[] = complaints.map((c) => ({
    id: c.id,
    title: c.title,
    extractedData: c.extracted_data as ExtractedComplaintData | null,
  }));

  const matches = await searchCases(trimmedQuery, searchable);

  if (!matches) {
    return { results: null, error: "Search couldn't complete right now. Please try again." };
  }

  // Gemini's responseSchema guarantees JSON shape, not that the ids are
  // real -- drop anything that doesn't correspond to an actual case.
  const titleById = new Map(complaints.map((c) => [c.id, c.title]));
  const results = matches
    .filter((m) => titleById.has(m.complaintId))
    .map((m) => ({ ...m, title: titleById.get(m.complaintId)! }));

  return { results, error: null };
}
