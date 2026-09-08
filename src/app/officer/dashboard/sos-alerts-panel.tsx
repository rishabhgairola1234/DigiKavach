"use client";

import { useEffect, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { Siren, ShieldCheck, MapPin, ExternalLink, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeTime } from "@/lib/time";
import { resolveSosAlert } from "./sos-actions";
import { Bilingual } from "@/components/bilingual";

// Leaflet touches `window` at import time, so it can never be part of the
// server-rendered bundle -- `ssr: false` is what actually guarantees that
// (a plain top-level `import` would still get evaluated during SSR despite
// mini-map.tsx being a 'use client' file; 'use client' only controls where a
// component *hydrates*, not whether its module is evaluated on the server).
const MiniMap = dynamic(() => import("./mini-map").then((mod) => mod.MiniMap), {
  ssr: false,
  loading: () => <div className="h-44 w-full animate-pulse rounded-lg bg-border/40" />,
});

export type SosAlert = {
  id: string;
  civilian_id: string;
  civilianName: string;
  latitude: number;
  longitude: number;
  status: "active" | "resolved";
  created_at: string;
};

type SosAlertRow = {
  id: string;
  civilian_id: string;
  latitude: number;
  longitude: number;
  status: "active" | "resolved";
  created_at: string;
};

export function SosAlertsPanel({ initialAlerts }: { initialAlerts: SosAlert[] }) {
  const [alerts, setAlerts] = useState<SosAlert[]>(initialAlerts);
  const [, forceTick] = useState(0);

  // formatRelativeTime() depends on the current wall-clock time, which is
  // never the same between the server render and the moment the client
  // hydrates a few hundred ms (or seconds) later -- rendering it during SSR
  // guarantees a hydration mismatch ("4h ago" vs "3h ago"). `mounted` stays
  // false through the server render and the first client render (which React
  // requires to match exactly), then flips true once mounted, so the real
  // relative time only ever appears in a normal post-hydration client update.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Ticks the relative "Xs/m/h ago" timestamps without needing new data.
  useEffect(() => {
    const interval = setInterval(() => forceTick((n) => n + 1), 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("sos-alerts-officer")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sos_alerts" },
        async (payload: RealtimePostgresChangesPayload<SosAlertRow>) => {
          const row = payload.new as SosAlertRow;
          if (row.status !== "active") return;

          setAlerts((prev) =>
            prev.some((a) => a.id === row.id)
              ? prev
              : [{ ...row, civilianName: "Loading..." }, ...prev]
          );

          const { data: civilian } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", row.civilian_id)
            .single();

          setAlerts((prev) =>
            prev.map((a) =>
              a.id === row.id
                ? { ...a, civilianName: civilian?.full_name || civilian?.email || "Unknown" }
                : a
            )
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "sos_alerts" },
        (payload: RealtimePostgresChangesPayload<SosAlertRow>) => {
          const row = payload.new as SosAlertRow;
          if (row.status !== "active") {
            setAlerts((prev) => prev.filter((a) => a.id !== row.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <section className="mb-8 rounded-2xl border border-priority-high/25 bg-priority-high/[0.04] p-6">
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-priority-high/15 text-priority-high">
          <Siren className="h-5 w-5" />
        </div>
        <div>
          <Bilingual
            as="h2"
            en="Active SOS Alerts"
            hi="सक्रिय एसओएस अलर्ट"
            className="text-sm font-semibold text-foreground"
            hiClassName="block text-xs font-normal text-muted"
          />
          <p className="text-xs text-muted">Updates live as alerts come in</p>
        </div>
      </div>

      {alerts.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-4 text-sm text-muted">
          <ShieldCheck className="h-4 w-4 shrink-0 text-priority-low" />
          <Bilingual en="All clear — no active SOS alerts." hi="सब ठीक है — कोई सक्रिय एसओएस अलर्ट नहीं।" />
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {alerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              mounted={mounted}
              onResolved={() => setAlerts((prev) => prev.filter((a) => a.id !== alert.id))}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function AlertCard({
  alert,
  mounted,
  onResolved,
}: {
  alert: SosAlert;
  mounted: boolean;
  onResolved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <li className="pop-in overflow-hidden rounded-xl border border-priority-high/30 bg-background-elevated">
      <MiniMap latitude={alert.latitude} longitude={alert.longitude} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium text-foreground">{alert.civilianName}</p>
          <span className="shrink-0 text-xs text-muted">
            {mounted ? formatRelativeTime(alert.created_at) : null}
          </span>
        </div>
        <a
          href={`https://www.google.com/maps?q=${alert.latitude},${alert.longitude}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-accent-strong transition-colors hover:text-accent"
        >
          <MapPin className="h-3.5 w-3.5" />
          <Bilingual en="Open in Google Maps" hi="गूगल मैप्स में खोलें" />
          <ExternalLink className="h-3 w-3" />
        </a>

        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await resolveSosAlert(alert.id);
              // Removed here on success rather than waiting on the Realtime
              // UPDATE event to do it -- the resolving officer's own tab
              // should never depend on a round-trip through Realtime (which
              // can silently miss events after a dropped/reconnected socket)
              // just to see their own action take effect. Realtime still
              // handles this alert disappearing from *other* officers' tabs.
              if (result.error) {
                setError(result.error);
              } else {
                onResolved();
              }
            })
          }
          className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-priority-low/40 bg-priority-low/10 px-3 py-2 text-sm font-medium text-priority-low transition-all hover:bg-priority-low/20 active:scale-[0.98] disabled:opacity-60"
        >
          {pending && <Loader2 className="fade-in h-3.5 w-3.5 animate-spin" />}
          <Bilingual en="Mark Resolved" hi="सुलझाया गया चिह्नित करें" />
        </button>
        {error && <p className="mt-2 text-xs text-priority-high">{error}</p>}
      </div>
    </li>
  );
}
