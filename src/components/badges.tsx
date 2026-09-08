import { Link2, AlarmClock } from "lucide-react";
import {
  COMPLAINT_STATUS_LABEL,
  COMPLAINT_STATUS_LABEL_HI,
  COMPLAINT_STATUS_BADGE_CLASSES,
  PRIORITY_LABEL,
  PRIORITY_LABEL_HI,
  PRIORITY_BADGE_CLASSES,
  type ComplaintStatus,
  type ComplaintPriority,
} from "@/lib/complaints";
import { BilingualInline } from "@/components/bilingual";

// `bilingual` defaults to false so the officer side (which also uses this
// component) stays English-only -- only civilian-facing call sites pass it.
export function StatusBadge({
  status,
  bilingual = false,
}: {
  status: ComplaintStatus;
  bilingual?: boolean;
}) {
  return (
    <span
      className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${COMPLAINT_STATUS_BADGE_CLASSES[status]}`}
    >
      {bilingual ? (
        <BilingualInline en={COMPLAINT_STATUS_LABEL[status]} hi={COMPLAINT_STATUS_LABEL_HI[status]} />
      ) : (
        COMPLAINT_STATUS_LABEL[status]
      )}
    </span>
  );
}

export function PriorityBadge({
  priority,
  bilingual = false,
}: {
  priority: ComplaintPriority | null | undefined;
  bilingual?: boolean;
}) {
  if (!priority) {
    return (
      <span className="shrink-0 rounded-full border border-border bg-muted/10 px-2.5 py-1 text-xs font-medium text-muted">
        {bilingual ? <BilingualInline en="Unclassified" hi="अवर्गीकृत" /> : "Unclassified"}
      </span>
    );
  }

  return (
    <span
      className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${PRIORITY_BADGE_CLASSES[priority]}`}
    >
      {bilingual ? (
        <BilingualInline en={`${PRIORITY_LABEL[priority]} Priority`} hi={`${PRIORITY_LABEL_HI[priority]} प्राथमिकता`} />
      ) : (
        `${PRIORITY_LABEL[priority]} Priority`
      )}
    </span>
  );
}

export function OverdueBadge() {
  return (
    <span className="overdue-pulse inline-flex shrink-0 items-center gap-1 rounded-full border border-priority-medium/50 bg-priority-medium/20 px-2.5 py-1 text-xs font-semibold text-priority-medium">
      <AlarmClock className="h-3 w-3" />
      Overdue
    </span>
  );
}

export function LinkedCasesBadge({ count }: { count: number }) {
  if (count <= 0) return null;

  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-priority-medium/30 bg-priority-medium/15 px-2.5 py-1 text-xs font-medium text-priority-medium">
      <Link2 className="h-3 w-3" />
      Linked to {count} other case{count === 1 ? "" : "s"}
    </span>
  );
}
