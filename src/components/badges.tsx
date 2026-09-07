import { Link2 } from "lucide-react";
import {
  COMPLAINT_STATUS_LABEL,
  COMPLAINT_STATUS_BADGE_CLASSES,
  PRIORITY_LABEL,
  PRIORITY_BADGE_CLASSES,
  type ComplaintStatus,
  type ComplaintPriority,
} from "@/lib/complaints";

export function StatusBadge({ status }: { status: ComplaintStatus }) {
  return (
    <span
      className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${COMPLAINT_STATUS_BADGE_CLASSES[status]}`}
    >
      {COMPLAINT_STATUS_LABEL[status]}
    </span>
  );
}

export function PriorityBadge({
  priority,
}: {
  priority: ComplaintPriority | null | undefined;
}) {
  if (!priority) {
    return (
      <span className="shrink-0 rounded-full border border-border bg-muted/10 px-2.5 py-1 text-xs font-medium text-muted">
        Unclassified
      </span>
    );
  }

  return (
    <span
      className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${PRIORITY_BADGE_CLASSES[priority]}`}
    >
      {PRIORITY_LABEL[priority]} Priority
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
