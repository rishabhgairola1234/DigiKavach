import type { ComplaintStatus, ExtractedComplaintData } from "@/lib/complaints";

// How long a high-priority case can sit un-actioned ("filed" or
// "under_review") before it's flagged overdue. Lower this temporarily (e.g.
// to 0.05 for ~3 minutes) to demo overdue flagging without waiting a full day.
export const OVERDUE_THRESHOLD_HOURS = 24;

const OVERDUE_THRESHOLD_MS = OVERDUE_THRESHOLD_HOURS * 60 * 60 * 1000;

/**
 * Computed at read-time from existing columns -- no new column, no
 * background job. A case is overdue if it's high priority, still
 * un-actioned, and has been sitting that way longer than the threshold.
 */
export function isCaseOverdue(caseData: {
  status: ComplaintStatus;
  extracted_data: ExtractedComplaintData | null;
  created_at: string;
}): boolean {
  const isHighPriority = caseData.extracted_data?.priority === "high";
  const isUnactioned = caseData.status === "filed" || caseData.status === "under_review";
  if (!isHighPriority || !isUnactioned) return false;

  const ageMs = Date.now() - new Date(caseData.created_at).getTime();
  return ageMs > OVERDUE_THRESHOLD_MS;
}
