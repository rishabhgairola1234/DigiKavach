"use client";

import { useState, useTransition } from "react";
import { NotebookPen, Loader2 } from "lucide-react";
import { addOfficerNote } from "./actions";

export type OfficerNote = {
  id: string;
  note_text: string;
  created_at: string;
  officerName: string;
};

export function NotesPanel({
  complaintId,
  notes,
}: {
  complaintId: string;
  notes: OfficerNote[];
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || pending) return;

    startTransition(async () => {
      const result = await addOfficerNote(complaintId, trimmed);
      if (result.error) {
        setError(result.error);
      } else {
        setError(null);
        setText("");
      }
    });
  }

  return (
    <section className="mt-8 rounded-xl border border-border bg-background p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-strong">
          <NotebookPen className="h-4.5 w-4.5" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">Officer Notes</h2>
          <p className="text-xs text-muted">Private — visible to officers only</p>
        </div>
      </div>

      {notes.length === 0 ? (
        <p className="mb-4 text-sm text-muted">No notes yet.</p>
      ) : (
        <ul className="mb-4 flex max-h-72 flex-col gap-3 overflow-y-auto">
          {notes.map((n) => (
            <li
              key={n.id}
              className="pop-in rounded-lg border border-border bg-background-elevated p-3"
            >
              <p className="whitespace-pre-wrap text-sm text-foreground">{n.note_text}</p>
              <p className="mt-1.5 text-xs text-muted">
                {n.officerName} ·{" "}
                {new Date(n.created_at).toLocaleString("en-IN", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={pending}
          rows={3}
          placeholder="Add an investigation note..."
          className="resize-none rounded-lg border border-border bg-background-elevated px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent disabled:opacity-60"
        />
        {error && <p className="fade-in text-xs text-priority-high">{error}</p>}
        <button
          type="submit"
          disabled={pending || !text.trim()}
          className="inline-flex items-center justify-center gap-1.5 self-end rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-strong disabled:opacity-60"
        >
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Add Note
        </button>
      </form>
    </section>
  );
}
