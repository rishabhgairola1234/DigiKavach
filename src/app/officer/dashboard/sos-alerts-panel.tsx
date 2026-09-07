"use client";

import { useEffect, useState, useTransition } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { Siren, ShieldCheck, MapPin, ExternalLink, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeTime } from "@/lib/time";
import { MiniMap } from "./mini-map";
import { resolveSosAlert } from "./sos-actions";

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
          <h2 className="text-sm font-semibold text-foreground">
            Active SOS Alerts
          </h2>
          <p className="text-xs text-muted">Updates live as alerts come in</p>
        </div>
      </div>

      {alerts.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-4 text-sm text-muted">
          <ShieldCheck className="h-4 w-4 shrink-0 text-priority-low" />
          All clear — no active SOS alerts.
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {alerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} />
          ))}
        </ul>
      )}
    </section>
  );
}

function AlertCard({ alert }: { alert: SosAlert }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <li className="pop-in overflow-hidden rounded-xl border border-priority-high/30 bg-background-elevated">
      <MiniMap latitude={alert.latitude} longitude={alert.longitude} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium text-foreground">{alert.civilianName}</p>
          <span className="shrink-0 text-xs text-muted">
            {formatRelativeTime(alert.created_at)}
          </span>
        </div>
        <a
          href={`https://www.google.com/maps?q=${alert.latitude},${alert.longitude}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-accent-strong transition-colors hover:text-accent"
        >
          <MapPin className="h-3.5 w-3.5" />
          Open in Google Maps
          <ExternalLink className="h-3 w-3" />
        </a>

        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await resolveSosAlert(alert.id);
              if (result.error) setError(result.error);
            })
          }
          className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-priority-low/40 bg-priority-low/10 px-3 py-2 text-sm font-medium text-priority-low transition-colors hover:bg-priority-low/20 disabled:opacity-60"
        >
          {pending && <Loader2 className="fade-in h-3.5 w-3.5 animate-spin" />}
          Mark Resolved
        </button>
        {error && <p className="mt-2 text-xs text-priority-high">{error}</p>}
      </div>
    </li>
  );
}
