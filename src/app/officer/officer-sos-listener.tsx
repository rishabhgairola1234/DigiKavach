"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { Siren, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Bilingual } from "@/components/bilingual";

type SosAlertRow = {
  id: string;
  civilian_id: string;
  status: "active" | "resolved";
  created_at: string;
};

type Toast = { id: string; civilianName: string };

const AUTO_DISMISS_MS = 20000;

/**
 * Mounted once at the /officer/* layout level so an active SOS is impossible
 * to miss regardless of which officer page is open -- not just the
 * dashboard's own SosAlertsPanel, which only helps if that page happens to be
 * open already.
 */
export function OfficerSosListener() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  function dismiss(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function subscribeIfOfficer() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (cancelled || profile?.role !== "officer") return;

      const channel = supabase
        .channel("officer-global-sos-toast")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "sos_alerts" },
          async (payload: RealtimePostgresChangesPayload<SosAlertRow>) => {
            const row = payload.new as SosAlertRow;
            if (row.status !== "active") return;

            console.log("[OfficerSosListener] INSERT received:", row.id);

            let isDuplicate = false;
            setToasts((prev) => {
              if (prev.some((t) => t.id === row.id)) {
                // Same reasoning as NotificationBell's guard: Realtime can
                // redeliver an INSERT on reconnect, and without this check a
                // redelivered alert silently duplicated both the toast and
                // (now that sound works) the alert tone.
                console.log("[OfficerSosListener] Duplicate INSERT for", row.id, "-- ignoring.");
                isDuplicate = true;
                return prev;
              }
              return [{ id: row.id, civilianName: "Loading..." }, ...prev];
            });
            if (isDuplicate) return;

            const { data: civilian } = await supabase
              .from("profiles")
              .select("full_name, email")
              .eq("id", row.civilian_id)
              .single();

            setToasts((prev) =>
              prev.map((t) =>
                t.id === row.id
                  ? { ...t, civilianName: civilian?.full_name || civilian?.email || "Unknown" }
                  : t
              )
            );

            setTimeout(() => dismiss(row.id), AUTO_DISMISS_MS);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }

    const cleanupPromise = subscribeIfOfficer();
    return () => {
      cancelled = true;
      cleanupPromise.then((cleanup) => cleanup?.());
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-3 px-4">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pop-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border-2 border-priority-high/60 bg-background-elevated p-4 shadow-lg shadow-priority-high/20"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-priority-high/15 text-priority-high">
            <Siren className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <Bilingual
              as="p"
              en="New SOS Alert"
              hi="नया एसओएस अलर्ट"
              className="text-sm font-semibold text-priority-high"
              hiClassName="ml-1 text-xs font-normal text-priority-high/70"
            />
            <p className="mt-0.5 truncate text-xs text-muted">{toast.civilianName} needs help</p>
            <Link
              href="/officer/dashboard"
              onClick={() => dismiss(toast.id)}
              className="mt-2 inline-block text-xs font-medium text-accent-strong underline transition-all hover:text-accent active:scale-[0.98]"
            >
              <Bilingual en="View on dashboard" hi="डैशबोर्ड पर देखें" />
            </Link>
          </div>
          <button
            onClick={() => dismiss(toast.id)}
            className="shrink-0 text-muted transition-all hover:text-foreground active:scale-[0.98]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
