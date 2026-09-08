"use client";

import { useState, useTransition } from "react";
import { Sparkles, Loader2, AlertCircle } from "lucide-react";
import { generateBriefing } from "./briefing-actions";

export function BriefingPanel() {
  const [briefing, setBriefing] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleGenerate() {
    setError(null);
    startTransition(async () => {
      const result = await generateBriefing();
      setBriefing(result.briefing);
      setError(result.error);
      if (result.briefing) setGeneratedAt(new Date());
    });
  }

  return (
    <section className="mb-6 rounded-xl border border-accent/30 bg-accent-soft p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-white">
            <Sparkles className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Today&apos;s Briefing</h2>
            <p className="text-xs text-muted">
              {generatedAt
                ? `Generated ${generatedAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`
                : "AI-written orientation summary of new, overdue, and flagged cases"}
            </p>
          </div>
        </div>
        <button
          onClick={handleGenerate}
          disabled={pending}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-strong disabled:opacity-60"
        >
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {briefing ? "Regenerate" : "Generate Briefing"}
        </button>
      </div>

      {pending && <p className="fade-in mt-3 text-xs text-muted">Putting together your briefing...</p>}

      {error && !pending && (
        <div className="pop-in mt-4 flex items-center gap-2 rounded-lg border border-priority-high/30 bg-priority-high/10 px-3 py-2 text-sm text-priority-high">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {briefing && !pending && (
        <p className="pop-in mt-4 text-sm leading-relaxed text-foreground">{briefing}</p>
      )}
    </section>
  );
}
