import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ArrowLeft, Link2 } from "lucide-react";
import { CaseWebGraph, type CaseWebNode, type CaseWebLink } from "./case-web-graph";
import type { ComplaintPriority, ExtractedComplaintData } from "@/lib/complaints";
import { Bilingual, BilingualInline } from "@/components/bilingual";

export default async function CaseWebPage() {
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

  const { data: linkRows } = await supabase
    .from("complaint_links")
    .select("complaint_id_a, complaint_id_b, matched_on");

  const links = linkRows ?? [];

  // Only cases with at least one link are worth showing -- an isolated case
  // would just be a lone dot cluttering the graph for no reason.
  const linkedCaseIds = [
    ...new Set(links.flatMap((l) => [l.complaint_id_a, l.complaint_id_b])),
  ];

  const { data: complaintRows } = linkedCaseIds.length
    ? await supabase
        .from("complaints")
        .select("id, title, extracted_data")
        .in("id", linkedCaseIds)
    : { data: [] };

  const nodes: CaseWebNode[] = (complaintRows ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    priority: (c.extracted_data as ExtractedComplaintData | null)?.priority as
      | ComplaintPriority
      | null,
  }));

  const graphLinks: CaseWebLink[] = links.map((l) => ({
    source: l.complaint_id_a,
    target: l.complaint_id_b,
    matchedOn: l.matched_on,
  }));

  return (
    <div className="flex flex-1 flex-col bg-background bg-grid px-6 py-10">
      <div className="mx-auto w-full max-w-6xl">
        <Link
          href="/officer/dashboard"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted transition-all hover:text-foreground active:scale-[0.98]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <Bilingual en="Back to dashboard" hi="डैशबोर्ड पर वापस जाएं" />
        </Link>

        <div className="mb-6 flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-strong">
            <Link2 className="h-5 w-5" />
          </div>
          <div>
            <Bilingual
              as="h1"
              en="Case Web"
              hi="केस वेब"
              className="text-xl font-semibold text-foreground"
              hiClassName="ml-1.5 text-sm font-normal text-muted"
            />
            <p className="text-sm text-muted">
              Cases linked by a shared vehicle plate or person name. Click a
              node to open that case, click a link to view its shared entity's
              dossier.
            </p>
          </div>
        </div>

        {nodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-16 text-center">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent-soft text-accent-strong">
              <Link2 className="h-6 w-6" />
            </div>
            <Bilingual
              as="h3"
              en="No linked cases yet"
              hi="अभी तक कोई जुड़ा मामला नहीं"
              className="text-lg font-semibold text-foreground"
              hiClassName="block text-sm font-normal text-muted"
            />
            <p className="mt-2 max-w-sm text-sm text-muted">
              Once two or more cases share a vehicle plate or person name,
              they&apos;ll show up here connected in a graph.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-muted">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-priority-high" />
                <BilingualInline en="High priority" hi="उच्च प्राथमिकता" />
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-priority-medium" />
                <BilingualInline en="Medium priority" hi="मध्यम प्राथमिकता" />
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-priority-low" />
                <BilingualInline en="Low priority" hi="निम्न प्राथमिकता" />
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-muted" />
                <BilingualInline en="Unclassified" hi="अवर्गीकृत" />
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 bg-accent-strong" />
                <BilingualInline en="Vehicle plate match" hi="वाहन नंबर प्लेट मेल" />
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 bg-priority-medium" />
                <BilingualInline en="Person name match" hi="व्यक्ति नाम मेल" />
              </span>
            </div>
            <CaseWebGraph nodes={nodes} links={graphLinks} />
          </>
        )}
      </div>
    </div>
  );
}
