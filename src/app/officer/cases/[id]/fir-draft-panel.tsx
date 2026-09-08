"use client";

import { useState, useTransition } from "react";
import { FileText, Copy, Check, Loader2, AlertCircle } from "lucide-react";
import { generateCaseFir } from "./actions";
import { Bilingual } from "@/components/bilingual";

export function FirDraftPanel({ complaintId }: { complaintId: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleGenerate() {
    setError(null);
    setCopied(false);
    startTransition(async () => {
      const result = await generateCaseFir(complaintId);
      setDraft(result.draft);
      setError(result.error);
    });
  }

  function handleCopy() {
    if (!draft) return;
    navigator.clipboard.writeText(draft).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <section className="mt-8 rounded-xl border border-border bg-background p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-strong">
            <FileText className="h-4.5 w-4.5" />
          </div>
          <div>
            <Bilingual
              as="h2"
              en="FIR Draft"
              hi="एफआईआर मसौदा"
              className="text-sm font-semibold text-foreground"
              hiClassName="ml-1.5 text-xs font-normal text-muted"
            />
            <p className="text-xs text-muted">AI-drafted First Information Report</p>
          </div>
        </div>
        <button
          onClick={handleGenerate}
          disabled={pending}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition-all hover:bg-accent-strong active:scale-[0.98] disabled:opacity-60"
        >
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {draft ? (
            <Bilingual en="Regenerate" hi="पुनः बनाएं" />
          ) : (
            <Bilingual en="Generate FIR Draft" hi="एफआईआर मसौदा बनाएं" />
          )}
        </button>
      </div>

      {pending && (
        <p className="fade-in mt-3 text-xs text-muted">
          Generating FIR draft — this can take a few seconds...
        </p>
      )}

      {error && !pending && (
        <div className="pop-in mt-4 flex items-center gap-2 rounded-lg border border-priority-high/30 bg-priority-high/10 px-3 py-2 text-sm text-priority-high">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {draft && !pending && (
        <div className="pop-in mt-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs italic text-muted">
              AI-generated draft — review and verify all details before official use.
            </p>
            <button
              onClick={handleCopy}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-background-elevated px-2.5 py-1.5 text-xs font-medium text-foreground transition-all hover:border-accent/50 active:scale-[0.98]"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-priority-low" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? (
                <Bilingual en="Copied" hi="कॉपी किया गया" />
              ) : (
                <Bilingual en="Copy to clipboard" hi="क्लिपबोर्ड पर कॉपी करें" />
              )}
            </button>
          </div>
          <div className="rounded-lg border border-border bg-background-elevated p-6">
            <p className="mb-4 text-center text-xs font-semibold uppercase tracking-widest text-muted">
              First Information Report — Draft
            </p>
            <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-foreground">
              {draft}
            </pre>
          </div>
        </div>
      )}
    </section>
  );
}
