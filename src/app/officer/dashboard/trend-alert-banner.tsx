"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { TrendingUp, Loader2, Sparkles, AlertTriangle } from "lucide-react";
import { CATEGORY_LABEL } from "@/lib/complaints";
import type { TrendAlert } from "@/lib/trend-detection";
import { getPatrolRecommendation } from "./trend-actions";
import { Bilingual, BilingualInline } from "@/components/bilingual";

export function TrendAlertBanner({ alerts }: { alerts: TrendAlert[] }) {
  if (alerts.length === 0) return null;

  return (
    <div className="mb-8 flex flex-col gap-4 rounded-2xl border border-accent/30 bg-accent-soft p-5">
      {alerts.map((alert, i) => (
        <TrendAlertItem key={i} alert={alert} />
      ))}
    </div>
  );
}

function TrendAlertItem({ alert }: { alert: TrendAlert }) {
  const [recommendation, setRecommendation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleGetRecommendation() {
    setError(null);
    startTransition(async () => {
      const result = await getPatrolRecommendation(
        alert.category,
        alert.location,
        alert.complaints.map((c) => c.id)
      );
      setRecommendation(result.recommendation);
      setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-start gap-2 text-sm">
        <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" />
        <p className="flex-1 text-foreground">
          <span className="font-semibold text-accent-strong">
            <BilingualInline en="Trend detected:" hi="रुझान पाया गया:" />
          </span>{" "}
          {alert.complaints.length} {CATEGORY_LABEL[alert.category].toLowerCase()} complaints
          near &quot;{alert.location}&quot; in the last 48 hours —{" "}
          {alert.complaints.map((c, idx) => (
            <span key={c.id}>
              <Link
                href={`/officer/cases/${c.id}`}
                className="font-medium underline transition-all hover:text-accent-strong active:scale-[0.98]"
              >
                {c.title}
              </Link>
              {idx < alert.complaints.length - 1 ? ", " : ""}
            </span>
          ))}
        </p>
        {!recommendation && (
          <button
            onClick={handleGetRecommendation}
            disabled={pending}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-accent/40 bg-background px-3 py-1.5 text-xs font-medium text-accent-strong transition-all hover:bg-accent/10 active:scale-[0.98] disabled:opacity-60"
          >
            {pending && <Loader2 className="h-3 w-3 animate-spin" />}
            <Bilingual en="Get Recommendation" hi="सिफारिश प्राप्त करें" />
          </button>
        )}
      </div>

      {pending && <p className="fade-in pl-6 text-xs text-muted">Analyzing pattern...</p>}

      {error && !pending && (
        <p className="pop-in flex items-center gap-1.5 pl-6 text-xs text-priority-high">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}

      {recommendation && !pending && (
        <div className="pop-in ml-6 flex items-start gap-2 rounded-lg border border-accent/30 bg-background px-3 py-2 text-sm text-foreground">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-strong" />
          {recommendation}
        </div>
      )}
    </div>
  );
}
