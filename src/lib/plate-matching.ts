// Mirrors the normalization used by the link_related_complaints database
// trigger (supabase/schema.sql, Step 9): uppercase, strip everything but
// letters and digits. Kept as one small pure function so the two places that
// need "is this the same plate" logic can never drift apart.
export function normalizePlate(text: string): string {
  return text.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export const MIN_PLATE_LENGTH = 4;

export type PlateMatch = {
  complaintId: string;
  title: string;
  createdAt: string;
  matchedPlate: string;
};
