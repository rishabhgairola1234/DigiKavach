"use client";

import { useRef, useState, useTransition } from "react";
import { Paperclip, Loader2 } from "lucide-react";
import { addComplaintEvidence } from "./actions";
import { Bilingual } from "@/components/bilingual";

export function AddEvidenceForm({ complaintId }: { complaintId: string }) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (selectedFiles.length === 0) {
      setError("Choose at least one file to upload.");
      return;
    }

    setError(null);
    setSuccess(false);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await addComplaintEvidence(complaintId, formData);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        setSelectedFiles([]);
        formRef.current?.reset();
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-background px-3 py-3 text-muted transition-colors hover:border-warm-accent/50">
        <Paperclip className="h-4 w-4 shrink-0" />
        <input
          name="files"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
          onChange={(e) => {
            setSelectedFiles(Array.from(e.target.files ?? []));
            setError(null);
            setSuccess(false);
          }}
          className="w-full text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-warm-accent/15 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-warm-accent file:transition-colors hover:file:bg-warm-accent/25"
        />
      </div>

      {selectedFiles.length > 0 && (
        <ul className="flex flex-col gap-1">
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

      {error && <p className="pop-in text-xs text-priority-high">{error}</p>}
      {success && (
        <p className="pop-in text-xs text-priority-low">Evidence added successfully.</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center gap-1.5 self-end rounded-lg bg-warm-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-warm-accent/90 disabled:opacity-60"
      >
        {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        <Bilingual en="Add Evidence" hi="साक्ष्य जोड़ें" />
      </button>
    </form>
  );
}
