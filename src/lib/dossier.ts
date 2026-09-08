import { normalizePlate } from "@/lib/plate-matching";

export type EntityType = "vehicle_plate" | "person_name";

export type EntityRef = { type: EntityType; value: string };

// Mirrors the person-name normalization used by the link_related_complaints
// database trigger (supabase/schema.sql, Step 9): trim + lowercase, nothing
// more -- kept as its own function so the two can't drift apart, same
// reasoning as normalizePlate in plate-matching.ts.
export function normalizePersonName(name: string): string {
  return name.trim().toLowerCase();
}

// complaint_links.matched_on is always written by the trigger as either
// "vehicle_plate: <PLATE>" or "person_name: <name>" -- this is the inverse of
// that formatting, used to turn a link's reason back into a navigable entity.
export function parseMatchedOn(matchedOn: string): EntityRef | null {
  const separatorIndex = matchedOn.indexOf(": ");
  if (separatorIndex === -1) return null;

  const type = matchedOn.slice(0, separatorIndex);
  const value = matchedOn.slice(separatorIndex + 2).trim();
  if (!value) return null;

  if (type === "vehicle_plate" || type === "person_name") {
    return { type, value };
  }
  return null;
}

export function encodeEntitySlug(entity: EntityRef): string {
  return encodeURIComponent(`${entity.type}:${entity.value}`);
}

export function decodeEntitySlug(slug: string): EntityRef | null {
  const decoded = decodeURIComponent(slug);
  const separatorIndex = decoded.indexOf(":");
  if (separatorIndex === -1) return null;

  const type = decoded.slice(0, separatorIndex);
  const value = decoded.slice(separatorIndex + 1);
  if (!value) return null;

  if (type === "vehicle_plate" || type === "person_name") {
    return { type, value };
  }
  return null;
}

export function normalizedValueForEntity(entity: EntityRef): string {
  return entity.type === "vehicle_plate"
    ? normalizePlate(entity.value)
    : normalizePersonName(entity.value);
}

export const ENTITY_TYPE_LABEL: Record<EntityType, string> = {
  vehicle_plate: "Vehicle Plate",
  person_name: "Person",
};

export type DossierEntry = {
  complaintId: string;
  title: string;
  incidentDatetime: string;
  location: string;
  createdAt: string;
  role: string;
};
