"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, AlertCircle, ArrowRight, SearchX } from "lucide-react";
import { searchCasesByQuery, type CaseSearchResult } from "./actions";
import { Bilingual } from "@/components/bilingual";

export function SearchForm() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CaseSearchResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await searchCasesByQuery(query);
      setResults(result.results);
      setError(result.error);
    });
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='e.g. "a suspect in a black jacket near metro stations"'
          className="flex-1 rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending || !query.trim()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-accent-strong active:scale-[0.98] disabled:opacity-60"
        >
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          <Bilingual en="Search" hi="खोजें" />
        </button>
      </form>

      {pending && <p className="fade-in mt-4 text-xs text-muted">Scanning cases for relevance...</p>}

      {error && !pending && (
        <div className="pop-in mt-4 flex items-center gap-2 rounded-lg border border-priority-high/30 bg-priority-high/10 px-3 py-2 text-sm text-priority-high">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {results && !pending && !error && (
        <div className="pop-in mt-6">
          {results.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-12 text-center">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent-strong">
                <SearchX className="h-5 w-5" />
              </div>
              <Bilingual
                as="h3"
                en="No genuine matches found"
                hi="कोई वास्तविक मेल नहीं मिला"
                className="text-sm font-semibold text-foreground"
                hiClassName="block text-xs font-normal text-muted"
              />
              <p className="mt-1 max-w-sm text-xs text-muted">
                Gemini didn&apos;t find any cases confidently relevant to that query. Try
                rephrasing or broadening it.
              </p>
            </div>
          ) : (
            <>
              <p className="mb-3 text-xs text-muted">
                {results.length} matching case{results.length === 1 ? "" : "s"}, ranked by relevance
              </p>
              <ol className="flex flex-col gap-2.5">
                {results.map((r, i) => (
                  <li key={r.complaintId}>
                    <Link
                      href={`/officer/cases/${r.complaintId}`}
                      className="group flex items-start gap-3 rounded-xl border border-border bg-background p-4 transition-all hover:border-accent/50 active:scale-[0.99]"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-strong">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{r.title}</p>
                        <p className="mt-0.5 text-xs text-muted">{r.reason}</p>
                      </div>
                      <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted transition-colors group-hover:text-accent-strong" />
                    </Link>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      )}
    </div>
  );
}
