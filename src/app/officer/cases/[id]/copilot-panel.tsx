"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Bot, Send, Loader2, AlertCircle, User } from "lucide-react";
import { askCopilot } from "./actions";
import { Bilingual } from "@/components/bilingual";

type Message = { role: "user" | "assistant" | "error"; content: string };

export function CopilotPanel({ complaintId }: { complaintId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [pending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || pending) return;

    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setQuestion("");

    startTransition(async () => {
      const result = await askCopilot(complaintId, q);
      setMessages((prev) => [
        ...prev,
        result.answer
          ? { role: "assistant", content: result.answer }
          : { role: "error", content: result.error ?? "Something went wrong." },
      ]);
    });
  }

  return (
    <section className="mt-8 rounded-xl border border-accent/30 bg-background p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-strong">
          <Bot className="h-4.5 w-4.5" />
        </div>
        <div>
          <Bilingual
            as="h2"
            en="Investigation Copilot"
            hi="जांच सहायक"
            className="text-sm font-semibold text-foreground"
            hiClassName="ml-1.5 text-xs font-normal text-muted"
          />
          <p className="text-xs text-muted">Ask questions about this case only</p>
        </div>
      </div>

      <div ref={scrollRef} className="mb-4 flex max-h-80 flex-col gap-3 overflow-y-auto">
        {messages.length === 0 && (
          <p className="text-sm text-muted">
            e.g. &quot;Summarize this case in two sentences&quot; or &quot;What
            follow-up questions should I ask the witness?&quot;
          </p>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`pop-in flex items-start gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {m.role !== "user" && (
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent-strong">
                {m.role === "error" ? (
                  <AlertCircle className="h-3.5 w-3.5" />
                ) : (
                  <Bot className="h-3.5 w-3.5" />
                )}
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                m.role === "user"
                  ? "bg-accent text-white"
                  : m.role === "error"
                    ? "border border-priority-high/30 bg-priority-high/10 text-priority-high"
                    : "border border-border bg-background-elevated text-foreground"
              }`}
            >
              <p className="whitespace-pre-wrap">{m.content}</p>
            </div>
            {m.role === "user" && (
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent text-white">
                <User className="h-3.5 w-3.5" />
              </div>
            )}
          </div>
        ))}

        {pending && (
          <div className="fade-in flex items-center gap-2 pl-8 text-xs text-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Thinking...
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={pending}
          placeholder="Ask about this case..."
          className="flex-1 rounded-lg border border-border bg-background-elevated px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={pending || !question.trim()}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-white transition-all hover:bg-accent-strong active:scale-[0.98] disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </section>
  );
}
