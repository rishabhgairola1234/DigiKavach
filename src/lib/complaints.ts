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

export const COMPLAINT_STATUS_BADGE_CLASSES: Record<ComplaintStatus, string> = {
  filed: "bg-muted/15 text-muted border-muted/30",
  under_review: "bg-priority-medium/15 text-priority-medium border-priority-medium/30",
  investigating: "bg-accent/15 text-accent-strong border-accent/30",
  resolved: "bg-priority-low/15 text-priority-low border-priority-low/30",
  closed: "bg-muted/15 text-muted border-muted/30",
};
