"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { FileText, Paperclip, ArrowLeft, Loader2, X } from "lucide-react";
import { Field } from "@/components/auth/field";
import { fileComplaint, type FileComplaintState } from "./actions";

const initialState: FileComplaintState = { error: null };

export function ComplaintForm() {
  const [state, formAction, pending] = useActionState(fileComplaint, initialState);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  return (
    <div className="flex flex-1 justify-center bg-background bg-grid px-6 py-16">
      <div className="w-full max-w-2xl">
        <Link
          href="/civilian/dashboard"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to dashboard
        </Link>

        <div className="rounded-2xl border border-border bg-background-elevated p-8">
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-warm-accent/15 text-warm-accent">
              <FileText className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground">
              File a Complaint
            </h1>
            <p className="mt-1 text-sm text-muted">
              Give us as much detail as you can — it helps investigators act
              faster.
            </p>
          </div>

          <form action={formAction} className="flex flex-col gap-5">
            <Field
              label="Complaint title"
              name="title"
              type="text"
              focusClassName="focus:border-warm-accent"
            />

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-foreground">
                Detailed description
              </span>
              <textarea
                name="description"
                required
                rows={6}
                placeholder="Describe what happened, who was involved, and anything else relevant..."
                className="resize-none rounded-lg border border-border bg-background px-3 py-2.5 text-foreground outline-none transition-colors placeholder:text-muted focus:border-warm-accent"
              />
            </label>

            <Field
              label="Incident date & time"
              name="incidentDatetime"
              type="datetime-local"
              focusClassName="focus:border-warm-accent"
            />

            <Field
              label="Incident location"
              name="location"
              type="text"
              focusClassName="focus:border-warm-accent"
            />

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-foreground">
                Evidence (images or PDFs, optional)
              </span>
              <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-background px-3 py-3 text-muted transition-colors hover:border-warm-accent/50">
                <Paperclip className="h-4 w-4 shrink-0" />
                <input
                  name="files"
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                  onChange={(e) =>
                    setSelectedFiles(Array.from(e.target.files ?? []))
                  }
                  className="w-full text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-warm-accent/15 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-warm-accent file:transition-colors hover:file:bg-warm-accent/25"
                />
              </div>
              {selectedFiles.length > 0 && (
                <ul className="mt-1 flex flex-col gap-1">
                  {selectedFiles.map((file, i) => (
                    <li
                      key={`${file.name}-${i}`}
                      className="flex items-center gap-1.5 text-xs text-muted"
                    >
                      <Paperclip className="h-3 w-3 shrink-0" />
                      <span className="truncate">{file.name}</span>
                      <span className="shrink-0 text-muted/70">
                        ({(file.size / 1024 / 1024).toFixed(1)}MB)
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </label>

            {state.error && (
              <p className="pop-in flex items-center gap-2 rounded-lg border border-priority-high/30 bg-priority-high/10 px-3 py-2 text-sm text-priority-high">
                <X className="h-4 w-4 shrink-0" />
                {state.error}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-warm-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-warm-accent/90 disabled:opacity-60"
            >
              {pending && <Loader2 className="fade-in h-4 w-4 shrink-0 animate-spin" />}
              {pending ? "Filing complaint & analyzing details..." : "Submit complaint"}
            </button>
            {pending && (
              <p className="fade-in text-center text-xs text-muted">
                This can take up to 30 seconds while our AI reviews the details.
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
