"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { MapPin } from "lucide-react";
import { formatRelativeTime } from "@/lib/time";
import { CATEGORY_LABEL, CATEGORY_LABEL_HI, CATEGORY_MAP_COLOR } from "@/lib/complaints";
import type { SafetyMapPoint } from "./heatmap";
import { Bilingual } from "@/components/bilingual";

const SafetyHeatmap = dynamic(() => import("./heatmap").then((mod) => mod.SafetyHeatmap), {
  ssr: false,
  loading: () => (
    <div className="flex h-[520px] w-full items-center justify-center rounded-xl border border-border text-sm text-muted">
      Loading map...
    </div>
  ),
});

export function SafetyMapClient({ points }: { points: SafetyMapPoint[] }) {
  const [focusPointId, setFocusPointId] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
      <div className="overflow-hidden rounded-xl border border-border">
        <SafetyHeatmap points={points} focusPointId={focusPointId} />
      </div>

      {points.length > 0 && (
        <div className="flex max-h-[520px] flex-col gap-2 overflow-y-auto rounded-xl border border-border bg-background-elevated p-3">
          <Bilingual
            as="p"
            en={`Reported Incidents (${points.length})`}
            hi="दर्ज घटनाएं"
            className="px-1 text-xs font-medium uppercase tracking-wide text-muted"
            hiClassName="ml-1.5 normal-case text-muted/80"
          />
          {points.map((point) => {
            const color = CATEGORY_MAP_COLOR[point.category ?? "other"];
            const isSelected = point.id === focusPointId;
            return (
              <button
                key={point.id}
                onClick={() => setFocusPointId(point.id)}
                className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                  isSelected
                    ? "border-warm-accent/60 bg-warm-accent/10"
                    : "border-transparent bg-background hover:border-warm-accent/30"
                }`}
              >
                <span
                  className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="flex flex-col">
                  <span className="font-medium text-foreground">
                    {point.category ? CATEGORY_LABEL[point.category] : "Other"}
                    <span className="ml-1.5 font-normal text-muted">
                      {point.category ? CATEGORY_LABEL_HI[point.category] : CATEGORY_LABEL_HI.other}
                    </span>
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {formatRelativeTime(point.createdAt)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
