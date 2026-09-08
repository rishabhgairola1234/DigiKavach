"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { NoNotificationsIllustration } from "@/components/illustrations/no-notifications-illustration";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeTime } from "@/lib/time";
import { markNotificationRead } from "./notification-actions";
import { Bilingual } from "@/components/bilingual";

export type Notification = {
  id: string;
  complaint_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

export function NotificationBell({
  initialNotifications,
}: {
  initialNotifications: Notification[];
}) {
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [open, setOpen] = useState(false);
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("notifications-civilian")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          const row = payload.new as Notification;
          console.log("[NotificationBell] INSERT received:", row.id);

          setNotifications((prev) => {
            if (prev.some((n) => n.id === row.id)) {
              // Realtime can redeliver an INSERT on reconnect (e.g. right
              // after a dev-server restart, or any dropped/rejoined
              // WebSocket) -- without this guard a redelivered row was
              // silently duplicated in the list (and, now that sound
              // actually plays, silently duplicated the notification tone
              // too). Same guard already used in sos-alerts-panel.tsx.
              console.log("[NotificationBell] Duplicate INSERT for", row.id, "-- ignoring.");
              return prev;
            }
            return [row, ...prev].slice(0, 20);
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications" },
        (payload) => {
          const updated = payload.new as Notification;
          setNotifications((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  function handleClickNotification(n: Notification) {
    if (!n.is_read) {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      markNotificationRead(n.id);
    }
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border text-muted transition-all hover:border-warm-accent/50 hover:text-warm-accent active:scale-[0.98]"
      >
        <Bell className="h-4.5 w-4.5" />
        {unreadCount > 0 && (
          <span className="pop-in absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-warm-accent px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="pop-in absolute right-0 top-12 z-20 max-h-96 w-80 overflow-y-auto rounded-xl border border-border bg-background-elevated shadow-xl">
            <div className="border-b border-border px-4 py-3">
              <Bilingual
                as="p"
                en="Notifications"
                hi="सूचनाएं"
                className="text-sm font-semibold text-foreground"
                hiClassName="text-xs font-normal text-muted"
              />
            </div>
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                <NoNotificationsIllustration className="pop-in h-14 w-14" />
                <Bilingual
                  as="p"
                  en="No notifications yet"
                  hi="अभी तक कोई सूचना नहीं"
                  className="text-sm text-muted"
                  hiClassName="block text-xs text-muted/80"
                />
              </div>
            ) : (
              <ul>
                {notifications.map((n) => (
                  <li key={n.id}>
                    <Link
                      href={`/civilian/complaints/${n.complaint_id}`}
                      onClick={() => handleClickNotification(n)}
                      className="block border-b border-border px-4 py-3 text-sm transition-all last:border-b-0 hover:bg-background active:scale-[0.98]"
                    >
                      <div className="flex items-start gap-2">
                        {!n.is_read && (
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-warm-accent" />
                        )}
                        <div className={n.is_read ? "text-muted" : "flex-1 text-foreground"}>
                          <p>{n.message}</p>
                          <p className="mt-1 text-xs text-muted">
                            {formatRelativeTime(n.created_at)}
                          </p>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
