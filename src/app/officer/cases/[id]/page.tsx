import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge, PriorityBadge, LinkedCasesBadge } from "@/components/badges";
import { StatusSelect } from "./status-select";
import { CopilotPanel } from "./copilot-panel";
import { evidenceDisplayName } from "@/lib/evidence";
import { otherComplaintId } from "@/lib/case-links";
import {
  ArrowLeft,
  User,
  MapPin,
  CalendarClock,
  Users,
  Car,
  Clock,
  Tag,
  Paperclip,
  Image as ImageIcon,
  FileText,
  ExternalLink,
  Link2,
} from "lucide-react";
import {
  CATEGORY_LABEL,
  type ComplaintStatus,
  type ExtractedComplaintData,
} from "@/lib/complaints";

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/officer/login");

  const { data: officerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (officerProfile?.role !== "officer") redirect("/officer/login");

  const { data: complaint } = await supabase
    .from("complaints")
    .select(
      "id, title, description, civilian_id, status, incident_datetime, location, extracted_data, created_at"
    )
    .eq("id", id)
    .single();

  if (!complaint) notFound();

  const status = complaint.status as ComplaintStatus;
  const extractedData = complaint.extracted_data as ExtractedComplaintData | null;

  const { data: civilianProfile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", complaint.civilian_id)
    .single();

  const { data: evidenceRows } = await supabase
    .from("evidence")
    .select("id, file_path, file_type, uploaded_at")
    .eq("complaint_id", complaint.id)
    .order("uploaded_at", { ascending: true });

  const evidence = await Promise.all(
    (evidenceRows ?? []).map(async (row) => {
      const { data: signed } = await supabase.storage
        .from("evidence")
        .createSignedUrl(row.file_path, 60 * 60);
      return { ...row, url: signed?.signedUrl ?? null };
    })
  );

  const { data: linkRows } = await supabase
    .from("complaint_links")
    .select("id, complaint_id_a, complaint_id_b, matched_on, created_at")
    .or(`complaint_id_a.eq.${complaint.id},complaint_id_b.eq.${complaint.id}`);

  const linkedCaseIds = (linkRows ?? []).map((l) => otherComplaintId(l, complaint.id));
  const { data: linkedComplaints } = linkedCaseIds.length
    ? await supabase.from("complaints").select("id, title").in("id", linkedCaseIds)
    : { data: [] };

  const linkedCaseTitleById = new Map((linkedComplaints ?? []).map((c) => [c.id, c.title]));
  const linkedCases = (linkRows ?? []).map((l) => {
    const otherId = otherComplaintId(l, complaint.id);
    return {
      id: otherId,
      title: linkedCaseTitleById.get(otherId) ?? "Unknown case",
      matchedOn: l.matched_on,
    };
  });

  return (
    <div className="flex flex-1 flex-col bg-background bg-grid px-6 py-10">
      <div className="mx-auto w-full max-w-4xl">
        <Link
          href="/officer/dashboard"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to all cases
        </Link>

        <div className="rounded-2xl border border-border bg-background-elevated p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">
                {complaint.title}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <User className="h-4 w-4" />
                  {civilianProfile?.full_name || civilianProfile?.email || "Unknown"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarClock className="h-4 w-4" />
                  {new Date(complaint.incident_datetime).toLocaleString("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  {complaint.location}
                </span>
                {extractedData && (
                  <span className="inline-flex items-center gap-1.5">
                    <Tag className="h-4 w-4" />
                    {CATEGORY_LABEL[extractedData.category]}
                  </span>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <LinkedCasesBadge count={linkedCases.length} />
              <PriorityBadge priority={extractedData?.priority} />
              <StatusBadge status={status} />
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3 border-y border-border py-4">
            <span className="text-sm font-medium text-foreground">Status:</span>
            <StatusSelect complaintId={complaint.id} status={status} />
          </div>

          <section className="mt-6">
            <h2 className="text-sm font-semibold text-foreground">
              Full Description
            </h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted">
              {complaint.description}
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-sm font-semibold text-foreground">
              AI-Extracted Entities
            </h2>
            {!extractedData ? (
              <p className="mt-2 text-sm text-muted">
                AI extraction is unavailable for this case.
              </p>
            ) : (
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <EntityPanel icon={Users} title="People">
                  {extractedData.people.length === 0 ? (
                    <EmptyEntity />
                  ) : (
                    <ul className="flex flex-col gap-1.5">
                      {extractedData.people.map((p, i) => (
                        <li key={i} className="text-sm text-foreground">
                          {p.name ? (
                            <span className="font-medium">{p.name}</span>
                          ) : (
                            <span className="text-muted">Unnamed</span>
                          )}{" "}
                          <span className="text-muted">— {p.description}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </EntityPanel>

                <EntityPanel icon={Car} title="Vehicles">
                  {extractedData.vehicles.length === 0 ? (
                    <EmptyEntity />
                  ) : (
                    <ul className="flex flex-col gap-1.5">
                      {extractedData.vehicles.map((v, i) => (
                        <li key={i} className="text-sm text-foreground">
                          <span className="font-medium">{v.type}</span>
                          {v.plate_number && (
                            <span className="text-muted"> — {v.plate_number}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </EntityPanel>

                <EntityPanel icon={MapPin} title="Other Locations">
                  {extractedData.locations.length === 0 ? (
                    <EmptyEntity />
                  ) : (
                    <ul className="flex flex-col gap-1.5">
                      {extractedData.locations.map((loc, i) => (
                        <li key={i} className="text-sm text-foreground">
                          {loc}
                        </li>
                      ))}
                    </ul>
                  )}
                </EntityPanel>

                <EntityPanel icon={Clock} title="Other Times">
                  {extractedData.times.length === 0 ? (
                    <EmptyEntity />
                  ) : (
                    <ul className="flex flex-col gap-1.5">
                      {extractedData.times.map((t, i) => (
                        <li key={i} className="text-sm text-foreground">
                          {t}
                        </li>
                      ))}
                    </ul>
                  )}
                </EntityPanel>
              </div>
            )}
          </section>

          <section className="mt-8">
            <h2 className="text-sm font-semibold text-foreground">Evidence</h2>
            {evidence.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No evidence uploaded.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {evidence.map((file) => {
                  const Icon = file.file_type.startsWith("image/")
                    ? ImageIcon
                    : FileText;
                  return (
                    <li key={file.id}>
                      {file.url ? (
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground transition-colors hover:border-accent/50"
                        >
                          <Icon className="h-4 w-4 shrink-0 text-accent-strong" />
                          <span className="truncate">
                            {evidenceDisplayName(file.file_path)}
                          </span>
                          <ExternalLink className="ml-auto h-3.5 w-3.5 shrink-0 text-muted" />
                        </a>
                      ) : (
                        <div className="flex items-center gap-2.5 rounded-lg border border-dashed border-border px-3 py-2.5 text-sm text-muted">
                          <Paperclip className="h-4 w-4 shrink-0" />
                          <span className="truncate">
                            {evidenceDisplayName(file.file_path)} (link unavailable)
                          </span>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {linkedCases.length > 0 && (
            <section className="mt-8">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <Link2 className="h-4 w-4 text-priority-medium" />
                Linked Cases
              </h2>
              <ul className="mt-3 flex flex-col gap-2">
                {linkedCases.map((lc) => (
                  <li key={`${lc.id}-${lc.matchedOn}`}>
                    <Link
                      href={`/officer/cases/${lc.id}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-priority-medium/30 bg-priority-medium/[0.06] px-3 py-2.5 text-sm transition-colors hover:border-priority-medium/60"
                    >
                      <span className="flex flex-col">
                        <span className="font-medium text-foreground">{lc.title}</span>
                        <span className="text-xs text-muted">
                          Matched on: {lc.matchedOn}
                        </span>
                      </span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <CopilotPanel complaintId={complaint.id} />
        </div>
      </div>
    </div>
  );
}

function EntityPanel({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Users;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>
      {children}
    </div>
  );
}

function EmptyEntity() {
  return <p className="text-sm text-muted">None mentioned.</p>;
}
