"use client";

import { useState } from "react";
import { Languages, ChevronDown, ChevronUp } from "lucide-react";

export function OriginalDescriptionToggle({
  language,
  originalText,
}: {
  language: string | null;
  originalText: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-accent-strong transition-all hover:text-accent active:scale-[0.98]"
      >
        <Languages className="h-3.5 w-3.5" />
        {open ? "Hide original" : "View original"}
        {language && <span className="text-muted">({language})</span>}
        {open ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
      </button>

      {open && (
        <p className="pop-in mt-2 whitespace-pre-wrap rounded-lg border border-border bg-background-elevated p-3 text-sm leading-relaxed text-muted">
          {originalText}
        </p>
      )}
    </div>
  );
}
