"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, MapPin, CalendarClock, User, Tag, UserCheck, ChevronDown } from "lucide-react";
import { NoCasesIllustration } from "@/components/illustrations/no-cases-illustration";
import { StatusBadge, PriorityBadge, LinkedCasesBadge, OverdueBadge } from "@/components/badges";
import {
  CATEGORY_LABEL,
  CATEGORY_LABEL_HI,
  COMPLAINT_STATUS_LABEL,
  COMPLAINT_STATUS_LABEL_HI,
  PRIORITY_SORT_RANK,
  type ComplaintCategory,
  type ComplaintStatus,
  type ExtractedComplaintData,
} from "@/lib/complaints";
import { Bilingual, BilingualInline } from "@/components/bilingual";

export type CaseListItem = {
  id: string;
  title: string;
  status: ComplaintStatus;
  incident_datetime: string;
  location: string;
  extracted_data: ExtractedComplaintData | null;
  created_at: string;
  civilianName: string;
  linkCount: number;
  isOverdue: boolean;
  assignedOfficerId: string | null;
  assignedOfficerName: string | null;
};

type SortMode = "priority" | "newest";
type AssignmentFilter = "all" | "mine";

const STATUS_OPTIONS: ComplaintStatus[] = [
  "filed",
  "under_review",
  "investigating",
  "resolved",
  "closed",
];

const CATEGORY_OPTIONS: ComplaintCategory[] = [
  "theft",
  "assault",
  "cybercrime",
  "harassment",
  "property_damage",
  "other",
];

export function CaseList({
  cases,
  currentOfficerId,
}: {
  cases: CaseListItem[];
  currentOfficerId: string;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ComplaintStatus | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<ComplaintCategory | "all">("all");
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>("all");
  const [sort, setSort] = useState<SortMode>("priority");

  const myAssignedCount = useMemo(
    () => cases.filter((c) => c.assignedOfficerId === currentOfficerId).length,
    [cases, currentOfficerId]
  );

  const filteredCases = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = cases.filter((c) => {
      if (assignmentFilter === "mine" && c.assignedOfficerId !== currentOfficerId) return false;
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (categoryFilter !== "all" && c.extracted_data?.category !== categoryFilter) return false;
      if (!query) return true;
      return (
        c.title.toLowerCase().includes(query) ||
        c.civilianName.toLowerCase().includes(query) ||
        c.location.toLowerCase().includes(query)
      );
    });

    return filtered.sort((a, b) => {
      // Overdue cases float to the top regardless of the chosen sort mode --
      // they can't be missed just because someone sorted by "Newest".
      if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;

      if (sort === "newest") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      const rankA = a.extracted_data ? PRIORITY_SORT_RANK[a.extracted_data.priority] : 3;
      const rankB = b.extracted_data ? PRIORITY_SORT_RANK[b.extracted_data.priority] : 3;
      if (rankA !== rankB) return rankA - rankB;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [cases, search, statusFilter, categoryFilter, assignmentFilter, currentOfficerId, sort]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Bilingual
          as="h2"
          en={
            <>
              {assignmentFilter === "mine" ? "My Assigned Cases" : "All Cases"}{" "}
              <span className="text-muted">({filteredCases.length})</span>
            </>
          }
          hi={assignmentFilter === "mine" ? "मेरे नियत मामले" : "सभी मामले"}
          className="text-lg font-semibold text-foreground"
          hiClassName="block text-xs font-normal text-muted"
        />
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-background-elevated p-1 text-sm">
            <button
              onClick={() => setAssignmentFilter("all")}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 transition-all active:scale-[0.98] ${
                assignmentFilter === "all" ? "bg-accent text-white" : "text-muted hover:text-foreground"
              }`}
            >
              <Bilingual en="All Cases" hi="सभी मामले" />
            </button>
            <button
              onClick={() => setAssignmentFilter("mine")}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 transition-all active:scale-[0.98] ${
                assignmentFilter === "mine" ? "bg-accent text-white" : "text-muted hover:text-foreground"
              }`}
            >
              <Bilingual en={`My Assigned Cases (${myAssignedCount})`} hi="मेरे नियत मामले" />
            </button>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-background-elevated p-1 text-sm">
            <button
              onClick={() => setSort("priority")}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 transition-all active:scale-[0.98] ${
                sort === "priority" ? "bg-accent text-white" : "text-muted hover:text-foreground"
              }`}
            >
              <Bilingual en="Priority" hi="प्राथमिकता" />
            </button>
            <button
              onClick={() => setSort("newest")}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 transition-all active:scale-[0.98] ${
                sort === "newest" ? "bg-accent text-white" : "text-muted hover:text-foreground"
              }`}
            >
              <Bilingual en="Newest" hi="नवीनतम" />
            </button>
          </div>
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, civilian, or location..."
            className="w-full rounded-lg border border-border bg-background-elevated py-2.5 pl-9 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent"
          />
        </div>
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ComplaintStatus | "all")}
            className="w-full appearance-none rounded-lg border border-border bg-background-elevated py-2.5 pl-3 pr-9 text-sm text-foreground outline-none transition-colors focus:border-accent sm:w-auto"
          >
            <option value="all">All statuses / सभी स्थितियां</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {COMPLAINT_STATUS_LABEL[s]} / {COMPLAINT_STATUS_LABEL_HI[s]}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
        </div>
        <div className="relative">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as ComplaintCategory | "all")}
            className="w-full appearance-none rounded-lg border border-border bg-background-elevated py-2.5 pl-3 pr-9 text-sm text-foreground outline-none transition-colors focus:border-accent sm:w-auto"
          >
            <option value="all">All categories / सभी श्रेणियां</option>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]} / {CATEGORY_LABEL_HI[c]}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
        </div>
      </div>

      {filteredCases.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-16 text-center">
          <NoCasesIllustration className="pop-in mb-4 h-32 w-32" />
          <Bilingual
            as="h3"
            en={
              cases.length === 0
                ? "No cases yet"
                : assignmentFilter === "mine"
                  ? "No cases assigned to you"
                  : "No cases match your filters"
            }
            hi={
              cases.length === 0
                ? "अभी तक कोई मामला नहीं"
                : assignmentFilter === "mine"
                  ? "आपको कोई मामला नियत नहीं"
                  : "आपके फ़िल्टर से कोई मामला मेल नहीं खाता"
            }
            className="text-lg font-semibold text-foreground"
            hiClassName="block text-sm font-normal text-muted"
          />
          <p className="mt-2 max-w-sm text-sm text-muted">
            {cases.length === 0
              ? "Filed complaints will show up here as soon as civilians report them."
              : assignmentFilter === "mine"
                ? "Cases are auto-assigned by workload once AI extraction completes."
                : "Try adjusting your search or filters."}
          </p>
          {assignmentFilter === "mine" && cases.length > 0 && (
            <button
              onClick={() => setAssignmentFilter("all")}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-soft px-3 py-1.5 text-xs font-medium text-accent-strong transition-all hover:bg-accent/20 active:scale-[0.98]"
            >
              <Bilingual en="View All Cases" hi="सभी मामले देखें" />
            </button>
          )}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {filteredCases.map((c) => (
            <li key={c.id}>
              <Link
                href={`/officer/cases/${c.id}`}
                className="block rounded-xl border border-border bg-background-elevated p-5 transition-all hover:border-accent/40 active:scale-[0.99]"
              >
                <div className="flex items-start justify-between gap-4">
                  <h3 className="font-medium text-foreground">{c.title}</h3>
                  <div className="flex shrink-0 items-center gap-2">
                    {c.isOverdue && <OverdueBadge />}
                    <LinkedCasesBadge count={c.linkCount} />
                    <PriorityBadge priority={c.extracted_data?.priority} bilingual />
                    <StatusBadge status={c.status} bilingual />
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
                      <span className="text-muted/70">{CATEGORY_LABEL_HI[c.extracted_data.category]}</span>
                    </span>
                  )}
                  <span
                    className={`inline-flex items-center gap-1.5 ${
                      c.assignedOfficerId === currentOfficerId ? "font-medium text-accent-strong" : ""
                    }`}
                  >
                    <UserCheck className="h-3.5 w-3.5" />
                    {c.assignedOfficerName ? (
                      c.assignedOfficerId === currentOfficerId ? (
                        <BilingualInline en="Assigned to you" hi="आपको नियत" />
                      ) : (
                        <BilingualInline en={`Assigned: ${c.assignedOfficerName}`} hi="नियत अधिकारी" />
                      )
                    ) : (
                      <BilingualInline en="Unassigned" hi="अनियत" />
                    )}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
