"use client";

import { useState, useTransition } from "react";
import { Compass, Loader2, AlertCircle } from "lucide-react";
import { suggestCaseNextSteps } from "./actions";
import { Bilingual } from "@/components/bilingual";

export function NextStepsPanel({ complaintId }: { complaintId: string }) {
  const [steps, setSteps] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSuggest() {
    setError(null);
    startTransition(async () => {
      const result = await suggestCaseNextSteps(complaintId);
      setSteps(result.steps);
      setError(result.error);
    });
  }

  return (
    <section className="mt-6 rounded-xl border border-border bg-background p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-strong">
            <Compass className="h-4.5 w-4.5" />
          </div>
          <div>
            <Bilingual
              as="h2"
              en="Next Investigative Steps"
              hi="अगले जांच कदम"
              className="text-sm font-semibold text-foreground"
              hiClassName="ml-1.5 text-xs font-normal text-muted"
            />
            <p className="text-xs text-muted">AI-suggested actions based on this case's data</p>
          </div>
        </div>
        <button
          onClick={handleSuggest}
          disabled={pending}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition-all hover:bg-accent-strong active:scale-[0.98] disabled:opacity-60"
        >
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {steps ? (
            <Bilingual en="Re-suggest" hi="पुनः सुझाएं" />
          ) : (
            <Bilingual en="Suggest Next Steps" hi="अगले कदम सुझाएं" />
          )}
        </button>
      </div>

      {pending && <p className="fade-in mt-3 text-xs text-muted">Thinking through next steps...</p>}

      {error && !pending && (
        <div className="pop-in mt-4 flex items-center gap-2 rounded-lg border border-priority-high/30 bg-priority-high/10 px-3 py-2 text-sm text-priority-high">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {steps && !pending && (
        <div className="pop-in mt-4">
          <ol className="flex flex-col gap-2">
            {steps.map((step, i) => (
              <li
                key={i}
                className="flex items-start gap-2.5 rounded-lg border border-accent/30 bg-accent-soft px-3 py-2.5 text-sm text-foreground"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-white">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs italic text-muted">
            AI-suggested actions for reference — use your own judgment before acting.
          </p>
        </div>
      )}
    </section>
  );
}
