"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { COMPLAINT_STATUS_LABEL, COMPLAINT_STATUS_LABEL_HI, type ComplaintStatus } from "@/lib/complaints";
import { updateComplaintStatus } from "./actions";

const STATUS_OPTIONS: ComplaintStatus[] = [
  "filed",
  "under_review",
  "investigating",
  "resolved",
  "closed",
];

export function StatusSelect({
  complaintId,
  status,
}: {
  complaintId: string;
  status: ComplaintStatus;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      <select
        value={status}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value as ComplaintStatus;
          setError(null);
          startTransition(async () => {
            const result = await updateComplaintStatus(complaintId, next);
            if (result.error) setError(result.error);
          });
        }}
        className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent disabled:opacity-60"
      >
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {COMPLAINT_STATUS_LABEL[s]} / {COMPLAINT_STATUS_LABEL_HI[s]}
          </option>
        ))}
      </select>
      {pending && (
        <Loader2 className="fade-in h-4 w-4 shrink-0 animate-spin text-muted" />
      )}
      {error && <span className="fade-in text-xs text-priority-high">{error}</span>}
    </div>
  );
}
