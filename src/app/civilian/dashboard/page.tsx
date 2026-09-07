import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions/sign-out";
import {
  LogOut,
  FilePlus2,
  FileText,
  MapPin,
  CalendarClock,
  CheckCircle2,
} from "lucide-react";
import { StatusBadge } from "@/components/badges";
import { SosButton } from "./sos-button";
import { CallEmergencyButton } from "./call-emergency-button";
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

  return (
    <div className="flex flex-1 flex-col bg-background bg-grid px-6 py-10">
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between">
        <div>
          <p className="text-sm text-muted">Welcome back,</p>
          <h1 className="text-xl font-semibold text-foreground">
            {profile?.full_name || user.email}
          </h1>
        </div>
        <form action={signOut}>
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted transition-colors hover:border-warm-accent/50 hover:text-warm-accent">
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </form>
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

        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            Your Complaints
          </h2>
          <Link
            href="/civilian/complaints/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-warm-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-warm-accent/90"
          >
            <FilePlus2 className="h-4 w-4" />
            File a Complaint
          </Link>
        </div>

        {!complaints || complaints.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-16 text-center">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-warm-accent/15 text-warm-accent">
              <FileText className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              No complaints filed yet
            </h3>
            <p className="mt-2 max-w-sm text-sm text-muted">
              When you report an incident, it&apos;ll show up here so you can
              track its status.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {complaints.map((complaint) => {
              const status = complaint.status as ComplaintStatus;
              return (
                <li
                  key={complaint.id}
                  className="rounded-xl border border-border bg-background-elevated p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="font-medium text-foreground">
                      {complaint.title}
                    </h3>
                    <StatusBadge status={status} />
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
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
