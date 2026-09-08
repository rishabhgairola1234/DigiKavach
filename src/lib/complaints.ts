export type ComplaintStatus =
  | "filed"
  | "under_review"
  | "investigating"
  | "resolved"
  | "closed";

export const COMPLAINT_STATUS_LABEL: Record<ComplaintStatus, string> = {
  filed: "Filed",
  under_review: "Under Review",
  investigating: "Investigating",
  resolved: "Resolved",
  closed: "Closed",
};

// Hindi labels for the bilingual treatment on civilian-facing pages only --
// the officer side keeps English-only labels, so these are separate exports
// rather than baked into COMPLAINT_STATUS_LABEL itself.
export const COMPLAINT_STATUS_LABEL_HI: Record<ComplaintStatus, string> = {
  filed: "दर्ज",
  under_review: "समीक्षाधीन",
  investigating: "जांच जारी",
  resolved: "सुलझाया गया",
  closed: "बंद",
};

export const COMPLAINT_STATUS_BADGE_CLASSES: Record<ComplaintStatus, string> = {
  filed: "bg-muted/15 text-muted border-muted/30",
  under_review: "bg-priority-medium/15 text-priority-medium border-priority-medium/30",
  investigating: "bg-accent/15 text-accent-strong border-accent/30",
  resolved: "bg-priority-low/15 text-priority-low border-priority-low/30",
  closed: "bg-muted/15 text-muted border-muted/30",
};

export type ComplaintCategory =
  | "theft"
  | "assault"
  | "cybercrime"
  | "harassment"
  | "property_damage"
  | "other";

export type ComplaintPriority = "low" | "medium" | "high";

export type ExtractedPerson = { name: string | null; description: string };
export type ExtractedVehicle = { type: string; plate_number: string | null };

// Structured data Gemini extracts from a complaint's title + description.
// Stored as-is in complaints.extracted_data (jsonb); null if extraction
// never ran or failed.
export type ExtractedComplaintData = {
  people: ExtractedPerson[];
  vehicles: ExtractedVehicle[];
  locations: string[];
  times: string[];
  category: ComplaintCategory;
  priority: ComplaintPriority;
};

export const CATEGORY_LABEL: Record<ComplaintCategory, string> = {
  theft: "Theft",
  assault: "Assault",
  cybercrime: "Cybercrime",
  harassment: "Harassment",
  property_damage: "Property Damage",
  other: "Other",
};

// Civilian-facing bilingual labels only, same reasoning as
// COMPLAINT_STATUS_LABEL_HI above.
export const CATEGORY_LABEL_HI: Record<ComplaintCategory, string> = {
  theft: "चोरी",
  assault: "हमला",
  cybercrime: "साइबर अपराध",
  harassment: "उत्पीड़न",
  property_damage: "संपत्ति को नुकसान",
  other: "अन्य",
};

// Literal hex values (not CSS vars) because these are read by canvas/Leaflet
// drawing code, which can't resolve `var(--...)`. Reuses the app's existing
// palette where it maps cleanly; cybercrime gets one new violet since there's
// no existing token for it.
export const CATEGORY_MAP_COLOR: Record<ComplaintCategory, string> = {
  theft: "#38bdf8",
  assault: "#ef4444",
  cybercrime: "#a78bfa",
  harassment: "#f59e0b",
  property_damage: "#f97316",
  other: "#94a3b8",
};

export const PRIORITY_LABEL: Record<ComplaintPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const PRIORITY_BADGE_CLASSES: Record<ComplaintPriority, string> = {
  high: "bg-priority-high/15 text-priority-high border-priority-high/30",
  medium: "bg-priority-medium/15 text-priority-medium border-priority-medium/30",
  low: "bg-priority-low/15 text-priority-low border-priority-low/30",
};

// Rank used to sort case lists by priority, high first. Unclassified (no
// extracted_data yet) sorts last.
export const PRIORITY_SORT_RANK: Record<ComplaintPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};
