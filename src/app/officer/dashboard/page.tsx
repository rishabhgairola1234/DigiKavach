import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions/sign-out";
import { StatusBadge, PriorityBadge, LinkedCasesBadge } from "@/components/badges";
import { SosAlertsPanel, type SosAlert } from "./sos-alerts-panel";
import { buildLinkCountMap } from "@/lib/case-links";
import { LogOut, Radar, MapPin, CalendarClock, User, Tag } from "lucide-react";
import {
  CATEGORY_LABEL,
  PRIORITY_SORT_RANK,
  type ComplaintStatus,
  type ExtractedComplaintData,
} from "@/lib/complaints";

type SortMode = "priority" | "newest";

export default async function OfficerDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const { sort: sortParam } = await searchParams;
  const sort: SortMode = sortParam === "newest" ? "newest" : "priority";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/officer/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "officer") redirect("/officer/login");

  const { data: complaints } = await supabase
    .from("complaints")
    .select(
      "id, title, civilian_id, status, incident_datetime, location, extracted_data, created_at"
    )
    .order("created_at", { ascending: false });

  const { data: complaintLinks } = await supabase
    .from("complaint_links")
    .select("id, complaint_id_a, complaint_id_b, matched_on, created_at");

  const linkCountByComplaintId = buildLinkCountMap(complaintLinks ?? []);

  const { data: sosAlertRows } = await supabase
    .from("sos_alerts")
    .select("id, civilian_id, latitude, longitude, status, created_at")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  const civilianIds = [
    ...new Set([
      ...(complaints ?? []).map((c) => c.civilian_id),
      ...(sosAlertRows ?? []).map((a) => a.civilian_id),
    ]),
  ];
  const { data: civilianProfiles } = civilianIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", civilianIds)
    : { data: [] };

  const civilianById = new Map(
    (civilianProfiles ?? []).map((p) => [p.id, p.full_name || p.email])
  );

  const sosAlerts: SosAlert[] = (sosAlertRows ?? []).map((a) => ({
    ...a,
    status: a.status as "active" | "resolved",
    civilianName: civilianById.get(a.civilian_id) ?? "Unknown",
  }));

  const cases = (complaints ?? []).map((c) => ({
    ...c,
    status: c.status as ComplaintStatus,
    extracted_data: c.extracted_data as ExtractedComplaintData | null,
    civilianName: civilianById.get(c.civilian_id) ?? "Unknown",
  }));

  const sortedCases = [...cases].sort((a, b) => {
    if (sort === "newest") {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
    const rankA = a.extracted_data ? PRIORITY_SORT_RANK[a.extracted_data.priority] : 3;
    const rankB = b.extracted_data ? PRIORITY_SORT_RANK[b.extracted_data.priority] : 3;
    if (rankA !== rankB) return rankA - rankB;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className="flex flex-1 flex-col bg-background bg-grid px-6 py-10">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between">
        <div>
          <p className="text-sm text-muted">Signed in as</p>
          <h1 className="text-xl font-semibold text-foreground">
            {profile?.full_name || user.email}
          </h1>
        </div>
        <form action={signOut}>
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted transition-colors hover:border-accent/50 hover:text-accent-strong">
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </form>
      </header>

      <main className="mx-auto mt-8 w-full max-w-5xl">
        <SosAlertsPanel initialAlerts={sosAlerts} />

        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            All Cases <span className="text-muted">({sortedCases.length})</span>
          </h2>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-background-elevated p-1 text-sm">
            <Link
              href="/officer/dashboard?sort=priority"
              className={`rounded-md px-3 py-1.5 transition-colors ${
                sort === "priority"
                  ? "bg-accent text-white"
                  : "text-muted hover:text-foreground"
              }`}
            >
              Priority
            </Link>
            <Link
              href="/officer/dashboard?sort=newest"
              className={`rounded-md px-3 py-1.5 transition-colors ${
                sort === "newest"
                  ? "bg-accent text-white"
                  : "text-muted hover:text-foreground"
              }`}
            >
              Newest
            </Link>
          </div>
        </div>

        {sortedCases.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-16 text-center">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent-soft text-accent-strong">
              <Radar className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              No cases yet
            </h3>
            <p className="mt-2 max-w-sm text-sm text-muted">
              Filed complaints will show up here as soon as civilians report
              them.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {sortedCases.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/officer/cases/${c.id}`}
                  className="block rounded-xl border border-border bg-background-elevated p-5 transition-colors hover:border-accent/40"
                >
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="font-medium text-foreground">{c.title}</h3>
                    <div className="flex shrink-0 items-center gap-2">
                      <LinkedCasesBadge count={linkCountByComplaintId.get(c.id) ?? 0} />
                      <PriorityBadge priority={c.extracted_data?.priority} />
                      <StatusBadge status={c.status} />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5" />
                      {c.civilianName}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarClock className="h-3.5 w-3.5" />
                      {new Date(c.incident_datetime).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      {c.location}
                    </span>
                    {c.extracted_data && (
                      <span className="inline-flex items-center gap-1.5">
                        <Tag className="h-3.5 w-3.5" />
                        {CATEGORY_LABEL[c.extracted_data.category]}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
