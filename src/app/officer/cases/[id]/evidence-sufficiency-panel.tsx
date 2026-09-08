"use client";

import { useState, useTransition } from "react";
import { ListChecks, Loader2, AlertCircle } from "lucide-react";
import { checkCaseEvidenceSufficiency } from "./actions";

export function EvidenceSufficiencyPanel({ complaintId }: { complaintId: string }) {
  const [items, setItems] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleCheck() {
    setError(null);
    startTransition(async () => {
      const result = await checkCaseEvidenceSufficiency(complaintId);
      setItems(result.items);
      setError(result.error);
    });
  }

  return (
    <section className="mt-6 rounded-xl border border-border bg-background p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-strong">
            <ListChecks className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Evidence Sufficiency</h2>
            <p className="text-xs text-muted">AI-identified gaps in this case's evidence</p>
          </div>
        </div>
        <button
          onClick={handleCheck}
          disabled={pending}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-strong disabled:opacity-60"
        >
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {items ? "Re-check" : "Check Evidence Sufficiency"}
        </button>
      </div>

      {pending && (
        <p className="fade-in mt-3 text-xs text-muted">Checking evidence sufficiency...</p>
      )}

      {error && !pending && (
        <div className="pop-in mt-4 flex items-center gap-2 rounded-lg border border-priority-high/30 bg-priority-high/10 px-3 py-2 text-sm text-priority-high">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {items && !pending && (
        <div className="pop-in mt-4">
          <ul className="flex flex-col gap-2">
            {items.map((item, i) => (
              <li
                key={i}
                className="flex items-start gap-2 rounded-lg border border-priority-medium/30 bg-priority-medium/[0.06] px-3 py-2.5 text-sm text-foreground"
              >
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-priority-medium" />
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs italic text-muted">
            AI-generated checklist for reference — not a formal case assessment.
          </p>
        </div>
      )}
    </section>
  );
}
