import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions/sign-out";
import { SosAlertsPanel, type SosAlert } from "./sos-alerts-panel";
import { StatsRow } from "./stats-row";
import { CaseList, type CaseListItem } from "./case-list";
import { TrendAlertBanner } from "./trend-alert-banner";
import { BriefingPanel } from "./briefing-panel";
import { EmblemIcon } from "@/components/emblem-icon";
import { Bilingual } from "@/components/bilingual";
import { buildLinkCountMap } from "@/lib/case-links";
import { isCaseOverdue } from "@/lib/overdue";
import { detectTrends, TREND_LOOKBACK_DAYS, type TrendComplaint } from "@/lib/trend-detection";
import { LogOut, Network, Search } from "lucide-react";
import type { ComplaintStatus, ExtractedComplaintData } from "@/lib/complaints";

export default async function OfficerDashboardPage() {
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
      "id, title, civilian_id, status, incident_datetime, location, extracted_data, assigned_officer_id, created_at"
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

  const assignedOfficerIds = [
    ...new Set((complaints ?? []).flatMap((c) => (c.assigned_officer_id ? [c.assigned_officer_id] : []))),
  ];
  const { data: assignedOfficerProfiles } = assignedOfficerIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", assignedOfficerIds)
    : { data: [] };
  const officerNameById = new Map(
    (assignedOfficerProfiles ?? []).map((p) => [p.id, p.full_name || p.email])
  );

  const sosAlerts: SosAlert[] = (sosAlertRows ?? []).map((a) => ({
    ...a,
    status: a.status as "active" | "resolved",
    civilianName: civilianById.get(a.civilian_id) ?? "Unknown",
  }));

  const cases: CaseListItem[] = (complaints ?? []).map((c) => {
    const status = c.status as ComplaintStatus;
    const extracted_data = c.extracted_data as ExtractedComplaintData | null;
    return {
      ...c,
      status,
      extracted_data,
      civilianName: civilianById.get(c.civilian_id) ?? "Unknown",
      linkCount: linkCountByComplaintId.get(c.id) ?? 0,
      isOverdue: isCaseOverdue({ status, extracted_data, created_at: c.created_at }),
      assignedOfficerId: c.assigned_officer_id,
      assignedOfficerName: c.assigned_officer_id
        ? officerNameById.get(c.assigned_officer_id) ?? "Unknown officer"
        : null,
    };
  });

  const stats = {
    total: cases.length,
    activeSos: sosAlerts.length,
    highPriority: cases.filter((c) => c.extracted_data?.priority === "high").length,
    mediumPriority: cases.filter((c) => c.extracted_data?.priority === "medium").length,
    lowPriority: cases.filter((c) => c.extracted_data?.priority === "low").length,
    awaitingAction: cases.filter((c) => c.status === "filed" || c.status === "under_review")
      .length,
    overdue: cases.filter((c) => c.isOverdue).length,
  };

  // Read-time only, on data already fetched above -- no new query, no AI
  // call, no background job.
  const lookbackCutoff = Date.now() - TREND_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  const recentComplaintsForTrends: TrendComplaint[] = cases
    .filter((c) => c.extracted_data && new Date(c.created_at).getTime() >= lookbackCutoff)
    .map((c) => ({
      id: c.id,
      title: c.title,
      category: c.extracted_data!.category,
      location: c.location,
      created_at: c.created_at,
    }));
  const trendAlerts = detectTrends(recentComplaintsForTrends);

  return (
    <div className="flex flex-1 flex-col bg-background bg-grid px-6 py-10">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between">
        <div className="flex items-center gap-3">
          <EmblemIcon className="h-8 w-8 shrink-0 text-accent-strong" />
          <div>
            <Bilingual
              as="p"
              en="Signed in as"
              hi="इस रूप में साइन इन"
              className="text-sm text-muted"
              hiClassName="text-xs text-muted/80"
            />
            <h1 className="text-xl font-semibold text-foreground">
              {profile?.full_name || user.email}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/officer/search"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted transition-all hover:border-accent/50 hover:text-accent-strong active:scale-[0.98]"
          >
            <Search className="h-4 w-4" />
            <Bilingual en="Search" hi="खोजें" />
          </Link>
          <Link
            href="/officer/case-web"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted transition-all hover:border-accent/50 hover:text-accent-strong active:scale-[0.98]"
          >
            <Network className="h-4 w-4" />
            <Bilingual en="Case Web" hi="केस वेब" />
          </Link>
          <form action={signOut}>
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted transition-all hover:border-accent/50 hover:text-accent-strong active:scale-[0.98]">
              <LogOut className="h-4 w-4" />
              <Bilingual en="Sign out" hi="साइन आउट" />
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto mt-8 w-full max-w-5xl">
        {/* Active emergencies are the single most time-critical thing on this
            page, so they lead -- ahead of the informational briefing/trend
            panels below, which can wait a beat if there's an SOS live. */}
        <SosAlertsPanel initialAlerts={sosAlerts} />

        <BriefingPanel />

        <TrendAlertBanner alerts={trendAlerts} />

        <StatsRow stats={stats} />

        <CaseList cases={cases} currentOfficerId={user.id} />
      </main>
    </div>
  );
}
