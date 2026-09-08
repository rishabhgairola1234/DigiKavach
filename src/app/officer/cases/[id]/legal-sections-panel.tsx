"use client";

import { useState, useTransition } from "react";
import { Scale, Loader2 } from "lucide-react";
import { suggestCaseLegalSections } from "./actions";
import type { SuggestedLegalSection } from "@/lib/gemini/suggest-legal-sections";
import { Bilingual } from "@/components/bilingual";

export function LegalSectionsPanel({ complaintId }: { complaintId: string }) {
  const [sections, setSections] = useState<SuggestedLegalSection[] | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSuggest() {
    startTransition(async () => {
      const result = await suggestCaseLegalSections(complaintId);
      setSections(result);
    });
  }

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Scale className="h-4 w-4 text-accent-strong" />
          <Bilingual en="Suggested Legal Sections" hi="सुझाई गई कानूनी धाराएं" />
        </h2>
        <button
          onClick={handleSuggest}
          disabled={pending}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background-elevated px-3 py-1.5 text-xs font-medium text-foreground transition-all hover:border-accent/50 active:scale-[0.98] disabled:opacity-60"
        >
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {sections ? (
            <Bilingual en="Regenerate" hi="पुनः बनाएं" />
          ) : (
            <Bilingual en="Suggest Legal Sections" hi="कानूनी धाराएं सुझाएं" />
          )}
        </button>
      </div>

      {pending && (
        <p className="fade-in mt-3 text-xs text-muted">
          Suggesting legal sections...
        </p>
      )}

      {sections && sections.length > 0 && !pending && (
        <div className="pop-in mt-3">
          <ul className="flex flex-col gap-2">
            {sections.map((s, i) => (
              <li key={i} className="rounded-lg border border-border bg-background p-3">
                <p className="text-sm font-medium text-foreground">
                  {s.section} — {s.title}
                </p>
                <p className="mt-1 text-xs text-muted">{s.reason}</p>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs italic text-muted">
            AI-suggested starting points for reference — not a legal
            determination. Confirm applicable sections independently.
          </p>
        </div>
      )}
    </section>
  );
}
