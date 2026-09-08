import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ArrowLeft, FileSearch, MapPin, CalendarClock, ExternalLink } from "lucide-react";
import {
  decodeEntitySlug,
  normalizedValueForEntity,
  ENTITY_TYPE_LABEL,
  ENTITY_TYPE_LABEL_HI,
  type DossierEntry,
} from "@/lib/dossier";
import type { ExtractedComplaintData } from "@/lib/complaints";
import { Bilingual } from "@/components/bilingual";

export default async function DossierPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/officer/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "officer") redirect("/officer/login");

  const entity = decodeEntitySlug(slug);
  if (!entity) notFound();

  const normalizedValue = normalizedValueForEntity(entity);

  const { data: complaints } = await supabase
    .from("complaints")
    .select("id, title, location, incident_datetime, created_at, extracted_data")
    .not("extracted_data", "is", null);

  const entries: DossierEntry[] = [];
  for (const complaint of complaints ?? []) {
    const extracted = complaint.extracted_data as ExtractedComplaintData;

    if (entity.type === "vehicle_plate") {
      for (const vehicle of extracted.vehicles) {
        if (!vehicle.plate_number) continue;
        if (normalizedValueForEntity({ type: "vehicle_plate", value: vehicle.plate_number }) === normalizedValue) {
          entries.push({
            complaintId: complaint.id,
            title: complaint.title,
            incidentDatetime: complaint.incident_datetime,
            location: complaint.location,
            createdAt: complaint.created_at,
            role: vehicle.type,
          });
        }
      }
    } else {
      for (const person of extracted.people) {
        if (!person.name) continue;
        if (normalizedValueForEntity({ type: "person_name", value: person.name }) === normalizedValue) {
          entries.push({
            complaintId: complaint.id,
            title: complaint.title,
            incidentDatetime: complaint.incident_datetime,
            location: complaint.location,
            createdAt: complaint.created_at,
            role: person.description,
          });
        }
      }
    }
  }

  if (entries.length === 0) notFound();

  entries.sort(
    (a, b) => new Date(b.incidentDatetime).getTime() - new Date(a.incidentDatetime).getTime()
  );

  return (
    <div className="flex flex-1 flex-col bg-background bg-grid px-6 py-10">
      <div className="mx-auto w-full max-w-3xl">
        <Link
          href="/officer/case-web"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted transition-all hover:text-foreground active:scale-[0.98]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <Bilingual en="Back to Case Web" hi="केस वेब पर वापस जाएं" />
        </Link>

        <div className="rounded-2xl border border-border bg-background-elevated p-8">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-strong">
              <FileSearch className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                {ENTITY_TYPE_LABEL[entity.type]} Dossier
                <span className="ml-1.5 normal-case text-muted/80">
                  {ENTITY_TYPE_LABEL_HI[entity.type]} डोज़ियर
                </span>
              </p>
              <h1 className="text-2xl font-semibold text-foreground">{entity.value}</h1>
            </div>
          </div>

          <p className="mt-4 text-sm text-muted">
            Appears in {entries.length} case{entries.length === 1 ? "" : "s"} across this
            platform.
          </p>

          <ul className="mt-6 flex flex-col gap-3">
            {entries.map((entry, i) => (
              <li key={`${entry.complaintId}-${i}`}>
                <Link
                  href={`/officer/cases/${entry.complaintId}`}
                  className="block rounded-xl border border-border bg-background p-4 transition-all hover:border-accent/50 active:scale-[0.99]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-medium text-foreground">{entry.title}</h2>
                    <span className="shrink-0 rounded-full border border-accent/30 bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent-strong">
                      {entry.role}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarClock className="h-3.5 w-3.5" />
                      {new Date(entry.incidentDatetime).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      {entry.location}
                    </span>
                    <span className="ml-auto inline-flex items-center gap-1 text-accent-strong">
                      <Bilingual en="View case" hi="मामला देखें" />
                      <ExternalLink className="h-3 w-3" />
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
