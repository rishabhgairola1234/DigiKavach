import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions/sign-out";
import {
  LogOut,
  FilePlus2,
  MapPin,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ShieldAlert,
  MessageCircle,
  LifeBuoy,
} from "lucide-react";
import { StatusBadge } from "@/components/badges";
import { StatusTracker } from "@/components/status-tracker";
import { EmblemIcon } from "@/components/emblem-icon";
import { NoComplaintsIllustration } from "@/components/illustrations/no-complaints-illustration";
import { Bilingual } from "@/components/bilingual";
import { SosButton } from "./sos-button";
import { CallEmergencyButton } from "./call-emergency-button";
import { NotificationBell } from "./notification-bell";
import type { ComplaintStatus } from "@/lib/complaints";

export default async function CivilianDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ filed?: string }>;
}) {
  const { filed } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/civilian/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "civilian") redirect("/civilian/login");

  const { data: complaints } = await supabase
    .from("complaints")
    .select("id, title, status, incident_datetime, location, created_at")
    .eq("civilian_id", user.id)
    .order("created_at", { ascending: false });

  const { data: notifications } = await supabase
    .from("notifications")
    .select("id, complaint_id, message, is_read, created_at")
    .eq("civilian_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="flex flex-1 flex-col bg-background bg-grid px-6 py-10">
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between">
        <div className="flex items-center gap-3">
          <EmblemIcon className="h-8 w-8 shrink-0 text-warm-accent" />
          <div>
            <Bilingual
              as="p"
              en="Welcome back,"
              hi="आपका स्वागत है"
              className="text-sm text-muted"
              hiClassName="text-xs text-muted/80"
            />
            <h1 className="text-xl font-semibold text-foreground">
              {profile?.full_name || user.email}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <NotificationBell initialNotifications={notifications ?? []} />
          <form action={signOut}>
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted transition-all hover:border-warm-accent/50 hover:text-warm-accent active:scale-[0.98]">
              <LogOut className="h-4 w-4" />
              <Bilingual en="Sign out" hi="साइन आउट" />
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto mt-8 w-full max-w-4xl">
        <div className="mb-8 flex flex-col items-center gap-8 rounded-2xl border border-red-500/25 bg-red-500/[0.04] px-6 py-8 sm:flex-row sm:items-start sm:justify-center sm:gap-14">
          <SosButton />
          <CallEmergencyButton />
        </div>

        {filed === "1" && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-priority-low/30 bg-priority-low/10 px-4 py-3 text-sm text-priority-low">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Complaint filed successfully. We&apos;ll update its status as it
            moves through investigation.
          </div>
        )}

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Bilingual
            as="h2"
            en="Your Complaints"
            hi="आपकी शिकायतें"
            className="text-lg font-semibold text-foreground"
            hiClassName="block text-xs font-normal text-muted"
          />
          <div className="flex items-center gap-3">
            <Link
              href="/safety-map"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted transition-all hover:border-warm-accent/50 hover:text-warm-accent active:scale-[0.98]"
            >
              <ShieldAlert className="h-4 w-4" />
              <Bilingual en="Safety Map" hi="सुरक्षा मानचित्र" />
            </Link>
            <Link
              href="/civilian/safety-assistant"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted transition-all hover:border-warm-accent/50 hover:text-warm-accent active:scale-[0.98]"
            >
              <LifeBuoy className="h-4 w-4" />
              <Bilingual en="Safety Assistant" hi="सुरक्षा सहायक" />
            </Link>
            <Link
              href="/civilian/complaints/chat"
              className="inline-flex items-center gap-1.5 rounded-lg border border-warm-accent/40 bg-warm-accent/10 px-4 py-2 text-sm font-semibold text-warm-accent transition-all hover:bg-warm-accent/20 active:scale-[0.98]"
            >
              <MessageCircle className="h-4 w-4" />
              <Bilingual en="File via Chat" hi="चैट द्वारा दर्ज करें" />
            </Link>
            <Link
              href="/civilian/complaints/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-warm-accent px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-warm-accent/90 active:scale-[0.98]"
            >
              <FilePlus2 className="h-4 w-4" />
              <Bilingual en="File a Complaint" hi="शिकायत दर्ज करें" />
            </Link>
          </div>
        </div>

        {!complaints || complaints.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-16 text-center">
            <NoComplaintsIllustration className="pop-in mb-4 h-32 w-32" />
            <Bilingual
              as="h3"
              en="No complaints filed yet"
              hi="अभी तक कोई शिकायत दर्ज नहीं"
              className="text-lg font-semibold text-foreground"
              hiClassName="block text-sm font-normal text-muted"
            />
            <p className="mt-2 max-w-sm text-sm text-muted">
              When you report an incident, it&apos;ll show up here so you can
              track its status.
            </p>
            <Link
              href="/civilian/complaints/new"
              className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-warm-accent px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-warm-accent/90 active:scale-[0.98]"
            >
              <FilePlus2 className="h-4 w-4" />
              <Bilingual en="File a Complaint" hi="शिकायत दर्ज करें" />
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {complaints.map((complaint) => {
              const status = complaint.status as ComplaintStatus;
              return (
                <li key={complaint.id}>
                  <Link
                    href={`/civilian/complaints/${complaint.id}`}
                    className="block rounded-xl border border-border bg-background-elevated p-5 transition-all hover:border-warm-accent/40 active:scale-[0.99]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="font-medium text-foreground">
                        {complaint.title}
                      </h3>
                      <StatusBadge status={status} bilingual />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarClock className="h-3.5 w-3.5" />
                        {new Date(complaint.incident_datetime).toLocaleString(
                          "en-IN",
                          { dateStyle: "medium", timeStyle: "short" }
                        )}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" />
                        {complaint.location}
                      </span>
                    </div>
                    <div className="mt-4">
                      <StatusTracker status={status} />
                    </div>
                    <div className="mt-4 flex items-center justify-end gap-1 text-xs font-medium text-warm-accent">
                      <Bilingual en="View Details & Evidence" hi="विवरण और साक्ष्य देखें" />
                      <ChevronRight className="h-3.5 w-3.5" />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
