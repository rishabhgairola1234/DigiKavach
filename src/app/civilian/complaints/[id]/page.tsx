import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StatusTracker } from "@/components/status-tracker";
import { AddEvidenceForm } from "./add-evidence-form";
import { evidenceDisplayName } from "@/lib/evidence";
import { Bilingual } from "@/components/bilingual";
import {
  ArrowLeft,
  MapPin,
  CalendarClock,
  Paperclip,
  Image as ImageIcon,
  FileText,
  ExternalLink,
} from "lucide-react";
import type { ComplaintStatus } from "@/lib/complaints";

export default async function ComplaintDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/civilian/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "civilian") redirect("/civilian/login");

  const { data: complaint } = await supabase
    .from("complaints")
    .select("id, title, description, civilian_id, status, incident_datetime, location, created_at")
    .eq("id", id)
    .single();

  if (!complaint || complaint.civilian_id !== user.id) notFound();

  const status = complaint.status as ComplaintStatus;

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

  return (
    <div className="flex flex-1 flex-col bg-background bg-grid px-6 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <Link
          href="/civilian/dashboard"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <Bilingual en="Back to dashboard" hi="डैशबोर्ड पर वापस जाएं" />
        </Link>

        <div className="rounded-2xl border border-border bg-background-elevated p-8">
          <h1 className="text-2xl font-semibold text-foreground">{complaint.title}</h1>

          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-muted">
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
          </div>

          <div className="mt-6 border-y border-border py-5">
            <StatusTracker status={status} />
          </div>

          <section className="mt-6">
            <Bilingual
              as="h2"
              en="Description"
              hi="विवरण"
              className="text-sm font-semibold text-foreground"
              hiClassName="ml-1.5 text-xs font-normal text-muted"
            />
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted">
              {complaint.description}
            </p>
          </section>

          <section className="mt-8">
            <Bilingual
              as="h2"
              en="Evidence"
              hi="साक्ष्य"
              className="text-sm font-semibold text-foreground"
              hiClassName="ml-1.5 text-xs font-normal text-muted"
            />
            {evidence.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No evidence uploaded yet.</p>
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
                          className="flex items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground transition-colors hover:border-warm-accent/50"
                        >
                          <Icon className="h-4 w-4 shrink-0 text-warm-accent" />
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

            <div className="mt-4">
              <Bilingual
                as="h3"
                en="Add More Evidence"
                hi="अधिक साक्ष्य जोड़ें"
                className="mb-2 text-xs font-medium uppercase tracking-wide text-muted"
                hiClassName="ml-1.5 normal-case text-muted/80"
              />
              <AddEvidenceForm complaintId={complaint.id} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
