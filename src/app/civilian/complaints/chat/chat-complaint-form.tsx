"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  MessageCircle,
  Sparkles,
  User,
  Send,
  Loader2,
  AlertTriangle,
  ArrowLeft,
  Paperclip,
  X,
  Pencil,
} from "lucide-react";
import { formatRelativeTime } from "@/lib/time";
import { chatComplaintTurn } from "./actions";
import { fileComplaint, checkForDuplicateComplaint, type FileComplaintState } from "../new/actions";
import { Bilingual } from "@/components/bilingual";

type Message = { role: "assistant" | "user"; content: string };

type ReviewData = {
  title: string;
  description: string;
  incidentDatetime: string; // datetime-local format: YYYY-MM-DDTHH:mm
  location: string;
};

const OPENING_MESSAGE =
  "Hi, I'm here to help you file your complaint. Take your time — can you start by telling me what happened?";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB, matches the regular form
const ALLOWED_FILE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
]);

function isoToDatetimeLocal(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function ChatComplaintForm() {
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", content: OPENING_MESSAGE }]);
  const [input, setInput] = useState("");
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatPending, startChatTransition] = useTransition();

  const [phase, setPhase] = useState<"chatting" | "review">("chatting");
  const [review, setReview] = useState<ReviewData>({
    title: "",
    description: "",
    incidentDatetime: "",
    location: "",
  });

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<{
    title: string;
    createdAt: string;
  } | null>(null);
  const [, startDuplicateCheck] = useTransition();

  const [submitState, setSubmitState] = useState<FileComplaintState>({ error: null });
  const [submitting, startSubmitTransition] = useTransition();

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, chatPending]);

  function runDuplicateCheck(data: ReviewData) {
    if (!data.title.trim() || !data.description.trim()) return;
    startDuplicateCheck(async () => {
      const result = await checkForDuplicateComplaint(data.title, data.description, data.location);
      setDuplicateWarning(result.duplicate);
    });
  }

  function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || chatPending) return;

    const nextMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setChatError(null);

    startChatTransition(async () => {
      const result = await chatComplaintTurn(nextMessages);

      if (result.error || !result.assistantMessage) {
        setChatError(result.error ?? "Something went wrong. Please try again.");
        return;
      }

      setMessages((prev) => [...prev, { role: "assistant", content: result.assistantMessage! }]);

      if (result.readyToSummarize && result.summary) {
        const data: ReviewData = {
          title: result.summary.title,
          description: result.summary.description,
          incidentDatetime: isoToDatetimeLocal(result.summary.incident_datetime_iso),
          location: result.summary.location,
        };
        setReview(data);
        setPhase("review");
        runDuplicateCheck(data);
      }
    });
  }

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) {
        setFileError(`"${file.name}" is larger than the 10MB limit.`);
        e.target.value = "";
        return;
      }
      if (!ALLOWED_FILE_TYPES.has(file.type)) {
        setFileError(`"${file.name}" is not a supported file type. Upload images or PDFs only.`);
        e.target.value = "";
        return;
      }
    }
    setFileError(null);
    setSelectedFiles(files);
  }

  function updateReviewField<K extends keyof ReviewData>(key: K, value: ReviewData[K]) {
    setReview((prev) => ({ ...prev, [key]: value }));
  }

  function handleConfirmSubmit() {
    setSubmitState({ error: null });
    startSubmitTransition(async () => {
      const formData = new FormData();
      formData.set("title", review.title);
      formData.set("description", review.description);
      formData.set("incidentDatetime", review.incidentDatetime);
      formData.set("location", review.location);
      for (const file of selectedFiles) formData.append("files", file);

      const result = await fileComplaint({ error: null }, formData);
      // A successful submission redirects away; if we get a result back at
      // all, something needs the civilian's attention.
      setSubmitState(result);
    });
  }

  return (
    <div className="flex flex-1 justify-center bg-background bg-grid px-6 py-16">
      <div className="w-full max-w-2xl">
        <Link
          href="/civilian/dashboard"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <Bilingual en="Back to dashboard" hi="डैशबोर्ड पर वापस जाएं" />
        </Link>

        <div className="rounded-2xl border border-border bg-background-elevated p-8">
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-warm-accent/15 text-warm-accent">
              <MessageCircle className="h-6 w-6" />
            </div>
            <Bilingual
              as="h1"
              en="File via Chat"
              hi="चैट द्वारा दर्ज करें"
              className="text-2xl font-semibold text-foreground"
              hiClassName="block text-sm font-normal text-muted"
            />
            <p className="mt-1 text-sm text-muted">
              Describe what happened in your own words — I&apos;ll ask a few
              follow-up questions.
            </p>
          </div>

          <div ref={scrollRef} className="mb-4 flex max-h-96 flex-col gap-3 overflow-y-auto">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`pop-in flex items-start gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.role === "assistant" && (
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-warm-accent/15 text-warm-accent">
                    <Sparkles className="h-3.5 w-3.5" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    m.role === "user"
                      ? "bg-warm-accent text-white"
                      : "border border-border bg-background text-foreground"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>
                {m.role === "user" && (
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-warm-accent text-white">
                    <User className="h-3.5 w-3.5" />
                  </div>
                )}
              </div>
            ))}

            {chatPending && (
              <div className="fade-in flex items-center gap-2 pl-8 text-xs text-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Thinking...
              </div>
            )}
          </div>

          {chatError && (
            <div className="pop-in mb-4 flex flex-col gap-2 rounded-lg border border-priority-high/30 bg-priority-high/10 px-3 py-2.5 text-sm text-priority-high">
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {chatError}
              </span>
              <Link
                href="/civilian/complaints/new"
                className="font-medium underline transition-colors hover:text-priority-high/80"
              >
                <Bilingual en="Use the regular form instead" hi="इसके बजाय सामान्य फॉर्म का उपयोग करें" />
              </Link>
            </div>
          )}

          {phase === "chatting" && (
            <form onSubmit={sendMessage} className="flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={chatPending}
                placeholder="Type your reply..."
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-warm-accent disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={chatPending || !input.trim()}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-warm-accent text-white transition-colors hover:bg-warm-accent/90 disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          )}

          {phase === "review" && (
            <div className="pop-in flex flex-col gap-5 border-t border-border pt-5">
              <div className="flex items-center justify-between">
                <Bilingual
                  as="p"
                  en="Review your complaint"
                  hi="अपनी शिकायत की समीक्षा करें"
                  className="text-sm font-semibold text-foreground"
                  hiClassName="block text-xs font-normal text-muted"
                />
                <button
                  type="button"
                  onClick={() => setPhase("chatting")}
                  className="inline-flex items-center gap-1 text-xs font-medium text-warm-accent underline transition-colors hover:text-warm-accent/80"
                >
                  <Pencil className="h-3 w-3" />
                  <Bilingual en="Keep chatting" hi="चैट जारी रखें" />
                </button>
              </div>

              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-foreground">
                  Complaint title
                  <span className="ml-1.5 font-normal text-muted">शिकायत का शीर्षक</span>
                </span>
                <input
                  type="text"
                  value={review.title}
                  onChange={(e) => updateReviewField("title", e.target.value)}
                  onBlur={() => runDuplicateCheck(review)}
                  className="rounded-lg border border-border bg-background px-3 py-2.5 text-foreground outline-none transition-colors focus:border-warm-accent"
                />
              </label>

              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-foreground">
                  Detailed description
                  <span className="ml-1.5 font-normal text-muted">विस्तृत विवरण</span>
                </span>
                <textarea
                  rows={5}
                  value={review.description}
                  onChange={(e) => updateReviewField("description", e.target.value)}
                  onBlur={() => runDuplicateCheck(review)}
                  className="resize-none rounded-lg border border-border bg-background px-3 py-2.5 text-foreground outline-none transition-colors focus:border-warm-accent"
                />
              </label>

              {duplicateWarning && (
                <div className="pop-in flex items-start gap-2 rounded-lg border border-priority-medium/30 bg-priority-medium/10 px-3 py-2 text-sm text-priority-medium">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>
                    You may have already filed a similar complaint:{" "}
                    <span className="font-medium">&quot;{duplicateWarning.title}&quot;</span>,
                    filed {formatRelativeTime(duplicateWarning.createdAt)} — you can still submit
                    this as a separate report if it&apos;s a different incident.{" "}
                    <button
                      type="button"
                      onClick={() => setDuplicateWarning(null)}
                      className="font-medium underline transition-colors hover:text-priority-medium/80"
                    >
                      <Bilingual en="Dismiss" hi="खारिज करें" />
                    </button>
                  </p>
                </div>
              )}

              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-foreground">
                  Incident date &amp; time
                  <span className="ml-1.5 font-normal text-muted">घटना की तारीख और समय</span>
                </span>
                <input
                  type="datetime-local"
                  value={review.incidentDatetime}
                  onChange={(e) => updateReviewField("incidentDatetime", e.target.value)}
                  className="rounded-lg border border-border bg-background px-3 py-2.5 text-foreground outline-none transition-colors focus:border-warm-accent"
                />
              </label>

              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-foreground">
                  Incident location
                  <span className="ml-1.5 font-normal text-muted">घटना का स्थान</span>
                </span>
                <input
                  type="text"
                  value={review.location}
                  onChange={(e) => updateReviewField("location", e.target.value)}
                  onBlur={() => runDuplicateCheck(review)}
                  className="rounded-lg border border-border bg-background px-3 py-2.5 text-foreground outline-none transition-colors focus:border-warm-accent"
                />
              </label>

              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-foreground">
                  Evidence (images or PDFs, optional)
                  <span className="ml-1.5 font-normal text-muted">साक्ष्य (वैकल्पिक)</span>
                </span>
                <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-background px-3 py-3 text-muted transition-colors hover:border-warm-accent/50">
                  <Paperclip className="h-4 w-4 shrink-0" />
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                    onChange={handleFilesSelected}
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
                {fileError && (
                  <p className="pop-in text-xs text-priority-high">{fileError}</p>
                )}
              </label>

              {submitState.error && (
                <p className="pop-in flex items-center gap-2 rounded-lg border border-priority-high/30 bg-priority-high/10 px-3 py-2 text-sm text-priority-high">
                  <X className="h-4 w-4 shrink-0" />
                  {submitState.error}
                </p>
              )}

              <button
                type="button"
                onClick={handleConfirmSubmit}
                disabled={submitting || !review.title.trim() || !review.description.trim() || !review.incidentDatetime || !review.location.trim()}
                className="mt-1 inline-flex items-center justify-center gap-2 rounded-lg bg-warm-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-warm-accent/90 disabled:opacity-60"
              >
                {submitting && <Loader2 className="fade-in h-4 w-4 shrink-0 animate-spin" />}
                {submitting ? (
                  "Filing complaint & analyzing details..."
                ) : (
                  <Bilingual en="Confirm & Submit" hi="पुष्टि करें और जमा करें" />
                )}
              </button>
              {submitting && (
                <p className="fade-in text-center text-xs text-muted">
                  This can take up to 30 seconds while our AI reviews the details.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
