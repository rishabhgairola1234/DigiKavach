"use server";

import { createClient } from "@/lib/supabase/server";
import { normalizePlate, MIN_PLATE_LENGTH, type PlateMatch } from "@/lib/plate-matching";
import type { ExtractedComplaintData } from "@/lib/complaints";

/**
 * Cross-references OCR-read plate text against every complaint's
 * extracted_data.vehicles. Returns null on no match, no auth, wrong role, or
 * any other failure -- this is a supplementary live-camera aid, not core
 * functionality, so it fails silently the same way legal-section suggestions
 * and other optional AI aids do elsewhere in this app.
 */
export async function findCaseByPlate(candidatePlates: string[]): Promise<PlateMatch | null> {
  const normalizedCandidates = [
    ...new Set(
      candidatePlates.map(normalizePlate).filter((p) => p.length >= MIN_PLATE_LENGTH)
    ),
  ];
  if (normalizedCandidates.length === 0) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "officer") return null;

  const { data: complaints } = await supabase
    .from("complaints")
    .select("id, title, created_at, extracted_data")
    .not("extracted_data", "is", null);

  for (const complaint of complaints ?? []) {
    const extracted = complaint.extracted_data as ExtractedComplaintData | null;
    if (!extracted) continue;

    for (const vehicle of extracted.vehicles) {
      if (!vehicle.plate_number) continue;
      const normalized = normalizePlate(vehicle.plate_number);
      if (normalized.length >= MIN_PLATE_LENGTH && normalizedCandidates.includes(normalized)) {
        return {
          complaintId: complaint.id,
          title: complaint.title,
          createdAt: complaint.created_at,
          matchedPlate: normalized,
        };
      }
    }
  }

  return null;
}
