import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge, PriorityBadge, LinkedCasesBadge, OverdueBadge } from "@/components/badges";
import { isCaseOverdue } from "@/lib/overdue";
import { StatusSelect } from "./status-select";
import { CopilotPanel } from "./copilot-panel";
import { FirDraftPanel } from "./fir-draft-panel";
import { OriginalDescriptionToggle } from "./original-description";
import { LegalSectionsPanel } from "./legal-sections-panel";
import { EvidenceSufficiencyPanel } from "./evidence-sufficiency-panel";
import { NextStepsPanel } from "./next-steps-panel";
import { NotesPanel, type OfficerNote } from "./notes-panel";
import { CameraIntelligencePanel } from "./camera-intelligence-panel";
import { RecordingsList, type CameraRecording } from "./recordings-list";
import { CaseDetailTabs, type CaseDetailTab } from "./case-detail-tabs";
import { evidenceDisplayName } from "@/lib/evidence";
import { otherComplaintId } from "@/lib/case-links";
import { parseMatchedOn, encodeEntitySlug } from "@/lib/dossier";
import {
  ArrowLeft,
  User,
  UserCheck,
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
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import {
  CATEGORY_LABEL,
  type ComplaintStatus,
  type ExtractedComplaintData,
} from "@/lib/complaints";
import { Bilingual, BilingualInline } from "@/components/bilingual";

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
      "id, title, description, original_language, original_description, civilian_id, status, incident_datetime, location, extracted_data, assigned_officer_id, created_at"
    )
    .eq("id", id)
    .single();

  if (!complaint) notFound();

  const status = complaint.status as ComplaintStatus;
  const extractedData = complaint.extracted_data as ExtractedComplaintData | null;
  const overdue = isCaseOverdue({
    status,
    extracted_data: extractedData,
    created_at: complaint.created_at,
  });

  // None of these depend on each other -- fetched together to avoid
  // needless round-trip latency.
  const [
    { data: civilianProfile },
    { data: assignedOfficerProfile },
    { data: evidenceRows },
    { data: linkRows },
    { data: noteRows },
    { data: recordingRows },
  ] = await Promise.all([
    supabase.from("profiles").select("full_name, email").eq("id", complaint.civilian_id).single(),
    complaint.assigned_officer_id
      ? supabase
          .from("profiles")
          .select("full_name, email")
          .eq("id", complaint.assigned_officer_id)
          .single()
      : Promise.resolve({ data: null }),
    supabase
      .from("evidence")
      .select("id, file_path, file_type, uploaded_at")
      .eq("complaint_id", complaint.id)
      .order("uploaded_at", { ascending: true }),
    supabase
      .from("complaint_links")
      .select("id, complaint_id_a, complaint_id_b, matched_on, created_at")
      .or(`complaint_id_a.eq.${complaint.id},complaint_id_b.eq.${complaint.id}`),
    supabase
      .from("officer_notes")
      .select("id, officer_id, note_text, created_at")
      .eq("complaint_id", complaint.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("camera_recordings")
      .select(
        "id, file_path, detected_objects, motion_timeline, key_moments, duration_seconds, file_hash, created_at"
      )
      .eq("complaint_id", complaint.id)
      .order("created_at", { ascending: false }),
  ]);

  const officerIds = [...new Set((noteRows ?? []).map((n) => n.officer_id))];
  const { data: noteAuthors } = officerIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", officerIds)
    : { data: [] };
  const officerNameById = new Map((noteAuthors ?? []).map((p) => [p.id, p.full_name || p.email]));

  const notes: OfficerNote[] = (noteRows ?? []).map((n) => ({
    id: n.id,
    note_text: n.note_text,
    created_at: n.created_at,
    officerName: officerNameById.get(n.officer_id) ?? "Unknown officer",
  }));

  const evidence = await Promise.all(
    (evidenceRows ?? []).map(async (row) => {
      const { data: signed } = await supabase.storage
        .from("evidence")
        .createSignedUrl(row.file_path, 60 * 60);
      return { ...row, url: signed?.signedUrl ?? null };
    })
  );

  const recordings: CameraRecording[] = await Promise.all(
    (recordingRows ?? []).map(async (row) => {
      const { data: signed } = await supabase.storage
        .from("camera-recordings")
        .createSignedUrl(row.file_path, 60 * 60);
      return {
        id: row.id,
        url: signed?.signedUrl ?? null,
        detected_objects: row.detected_objects as { label: string; timestamp: number }[],
        motion_timeline: row.motion_timeline as { timestamp: number; intensity: number }[],
        key_moments: row.key_moments as {
          timestamp: number;
          thumbnail_data_url: string;
          reason: string;
        }[],
        duration_seconds: Number(row.duration_seconds),
        file_hash: row.file_hash,
        created_at: row.created_at,
      };
    })
  );

  const linkedCaseIds = (linkRows ?? []).map((l) => otherComplaintId(l, complaint.id));
  const { data: linkedComplaints } = linkedCaseIds.length
    ? await supabase.from("complaints").select("id, title").in("id", linkedCaseIds)
    : { data: [] };

  const assignedOfficerName = complaint.assigned_officer_id
    ? assignedOfficerProfile?.full_name || assignedOfficerProfile?.email || "Unknown officer"
    : null;

  // Pure logic, no AI call: a case reads as ready for closure review once
  // it's actively being investigated, extraction succeeded, and at least one
  // piece of evidence backs it up. Suggestion only -- the officer still picks
  // the actual status via the dropdown below.
  const readyForClosure = status === "investigating" && extractedData !== null && evidence.length > 0;

  const linkedCaseTitleById = new Map((linkedComplaints ?? []).map((c) => [c.id, c.title]));
  const linkedCases = (linkRows ?? []).map((l) => {
    const otherId = otherComplaintId(l, complaint.id);
    return {
      id: otherId,
      title: linkedCaseTitleById.get(otherId) ?? "Unknown case",
      matchedOn: l.matched_on,
    };
  });

  const tabs: CaseDetailTab[] = [
    {
      id: "evidence",
      en: "Evidence",
      hi: "साक्ष्य",
      icon: <Paperclip className="h-4 w-4 shrink-0" />,
      content: (
        <>
          <section>
            <Bilingual
              as="h2"
              en="Evidence"
              hi="साक्ष्य"
              className="text-sm font-semibold text-foreground"
              hiClassName="ml-1.5 text-xs font-normal text-muted"
            />
            {evidence.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No evidence uploaded.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {evidence.map((file) => {
                  const Icon = file.file_type.startsWith("image/") ? ImageIcon : FileText;
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
                          <span className="truncate">{evidenceDisplayName(file.file_path)}</span>
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

          <CameraIntelligencePanel complaintId={complaint.id} tabId="evidence">
            <RecordingsList recordings={recordings} />
          </CameraIntelligencePanel>
        </>
      ),
    },
    {
      id: "ai-tools",
      en: "AI Tools",
      hi: "एआई उपकरण",
      icon: <Sparkles className="h-4 w-4 shrink-0" />,
      content: (
        <>
          <LegalSectionsPanel complaintId={complaint.id} />
          <EvidenceSufficiencyPanel complaintId={complaint.id} />
          <NextStepsPanel complaintId={complaint.id} />
        </>
      ),
    },
    {
      id: "fir-copilot",
      en: "FIR & Copilot",
      hi: "एफआईआर और सहायक",
      icon: <FileText className="h-4 w-4 shrink-0" />,
      content: (
        <>
          <FirDraftPanel complaintId={complaint.id} />
          <CopilotPanel complaintId={complaint.id} />
        </>
      ),
    },
    {
      id: "linked-notes",
      en: "Linked Cases & Notes",
      hi: "जुड़े मामले और टिप्पणियां",
      icon: <Link2 className="h-4 w-4 shrink-0" />,
      content: (
        <>
          {linkedCases.length > 0 && (
            <section>
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <Link2 className="h-4 w-4 text-priority-medium" />
                <Bilingual en="Linked Cases" hi="जुड़े हुए मामले" />
              </h2>
              <ul className="mt-3 flex flex-col gap-2">
                {linkedCases.map((lc) => {
                  const entity = parseMatchedOn(lc.matchedOn);
                  return (
                    <li
                      key={`${lc.id}-${lc.matchedOn}`}
                      className="rounded-lg border border-priority-medium/30 bg-priority-medium/[0.06] px-3 py-2.5"
                    >
                      <Link
                        href={`/officer/cases/${lc.id}`}
                        className="flex items-center justify-between gap-3 text-sm transition-all hover:text-accent-strong active:scale-[0.98]"
                      >
                        <span className="flex flex-col">
                          <span className="font-medium text-foreground">{lc.title}</span>
                          <span className="text-xs text-muted">Matched on: {lc.matchedOn}</span>
                        </span>
                        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted" />
                      </Link>
                      {entity && (
                        <Link
                          href={`/officer/dossier/${encodeEntitySlug(entity)}`}
                          className="mt-1.5 inline-block text-xs font-medium text-accent-strong underline transition-all hover:text-accent active:scale-[0.98]"
                        >
                          <Bilingual en="View Dossier" hi="डोज़ियर देखें" />
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <NotesPanel complaintId={complaint.id} notes={notes} />
        </>
      ),
    },
  ];

  return (
    <div className="flex flex-1 flex-col bg-background bg-grid px-6 py-10">
      <div className="mx-auto w-full max-w-4xl">
        <Link
          href="/officer/dashboard"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted transition-all hover:text-foreground active:scale-[0.98]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <Bilingual en="Back to all cases" hi="सभी मामलों पर वापस जाएं" />
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
                  <UserCheck className="h-4 w-4" />
                  {assignedOfficerName ? `Assigned to ${assignedOfficerName}` : "Unassigned"}
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
              {overdue && <OverdueBadge />}
              <LinkedCasesBadge count={linkedCases.length} />
              <PriorityBadge priority={extractedData?.priority} bilingual />
              <StatusBadge status={status} bilingual />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3 border-y border-border py-4">
            <span className="text-sm font-medium text-foreground">
              Status:<span className="ml-1 font-normal text-muted">स्थिति:</span>
            </span>
            <StatusSelect complaintId={complaint.id} status={status} />
            {readyForClosure && (
              <span className="pop-in inline-flex items-center gap-1.5 rounded-full border border-priority-low/40 bg-priority-low/15 px-3 py-1.5 text-xs font-semibold text-priority-low">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <BilingualInline en="Ready for Closure Review" hi="समापन समीक्षा हेतु तैयार" />
              </span>
            )}
          </div>

          {readyForClosure && (
            <p className="pop-in -mt-2 mb-2 flex items-start gap-2 rounded-lg border border-priority-low/30 bg-priority-low/[0.06] px-3 py-2.5 text-sm text-muted">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-priority-low" />
              This case is under investigation, has AI-extracted details, and at
              least one piece of evidence — it may be ready to move to
              Resolved or Closed. This is a suggestion only; use the status
              dropdown above to decide.
            </p>
          )}

          <section className="mt-6">
            <Bilingual
              as="h2"
              en="Full Description"
              hi="पूर्ण विवरण"
              className="text-sm font-semibold text-foreground"
              hiClassName="ml-1.5 text-xs font-normal text-muted"
            />
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted">
              {complaint.description}
            </p>
            {complaint.original_description && (
              <OriginalDescriptionToggle
                language={complaint.original_language}
                originalText={complaint.original_description}
              />
            )}
          </section>

          <section className="mt-8">
            <Bilingual
              as="h2"
              en="AI-Extracted Entities"
              hi="एआई-निष्कर्षित इकाइयां"
              className="text-sm font-semibold text-foreground"
              hiClassName="ml-1.5 text-xs font-normal text-muted"
            />
            {!extractedData ? (
              <p className="mt-2 text-sm text-muted">
                AI extraction is unavailable for this case.
              </p>
            ) : (
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <EntityPanel icon={Users} title="People" titleHi="व्यक्ति">
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

                <EntityPanel icon={Car} title="Vehicles" titleHi="वाहन">
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

                <EntityPanel icon={MapPin} title="Other Locations" titleHi="अन्य स्थान">
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

                <EntityPanel icon={Clock} title="Other Times" titleHi="अन्य समय">
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

          <CaseDetailTabs tabs={tabs} />
        </div>
      </div>
    </div>
  );
}

function EntityPanel({
  icon: Icon,
  title,
  titleHi,
  children,
}: {
  icon: typeof Users;
  title: string;
  titleHi: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
        <Icon className="h-3.5 w-3.5" />
        {title}
        <span className="normal-case text-muted/70">{titleHi}</span>
      </div>
      {children}
    </div>
  );
}

function EmptyEntity() {
  return <p className="text-sm text-muted">None mentioned.</p>;
}
