"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  LifeBuoy,
  Sparkles,
  User,
  Send,
  Loader2,
  AlertTriangle,
  ArrowLeft,
  PhoneCall,
  Info,
} from "lucide-react";
import { CallEmergencyButton } from "../dashboard/call-emergency-button";
import { safetyAssistantTurn } from "./actions";
import { Bilingual } from "@/components/bilingual";

type Message = { role: "assistant" | "user"; content: string; isDangerAlert?: boolean };

const OPENING_MESSAGE =
  "Hi, I'm your Safety Assistant. Ask me about what to do after a crime, preserving evidence, your " +
  "rights during a police stop, filing a complaint, or finding help nearby. If you're in danger right " +
  "now, just call 112 using the button above.";

const DANGER_RESPONSE_TEXT =
  "This sounds like an emergency. Please call 112 right now — don't wait. Use the Call 112 button above " +
  "or below to connect immediately.";

export function SafetyAssistantChat() {
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", content: OPENING_MESSAGE }]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || pending) return;

    const nextMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setError(null);

    startTransition(async () => {
      const result = await safetyAssistantTurn(
        nextMessages.map((m) => ({ role: m.role, content: m.content }))
      );

      if (result.error || !result.assistantMessage) {
        setError(result.error ?? "Something went wrong. Please try again.");
        return;
      }

      // The immediate-danger case is enforced here in code, not just in the
      // prompt: whatever text Gemini produced is discarded and replaced with
      // a fixed directive, so this is guaranteed to be the assistant's only
      // response in that situation, regardless of model output.
      if (result.isImmediateDanger) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: DANGER_RESPONSE_TEXT, isDangerAlert: true },
        ]);
        return;
      }

      setMessages((prev) => [...prev, { role: "assistant", content: result.assistantMessage! }]);
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
              <LifeBuoy className="h-6 w-6" />
            </div>
            <Bilingual
              as="h1"
              en="Safety Assistant"
              hi="सुरक्षा सहायक"
              className="text-2xl font-semibold text-foreground"
              hiClassName="block text-sm font-normal text-muted"
            />
            <p className="mt-1 text-sm text-muted">
              General safety and procedural guidance — not a real-time emergency
              response tool.
            </p>
          </div>

          {/* Always visible regardless of chat/Gemini state -- never depends
              on the assistant working. */}
          <div className="mb-6 flex flex-col items-center gap-3 rounded-xl border border-red-500/25 bg-red-500/[0.04] px-4 py-5">
            <CallEmergencyButton />
            <div className="flex items-start gap-1.5 text-center text-xs text-muted">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <Bilingual
                as="span"
                en="In an actual emergency, always call 112 — this assistant is a supplementary tool, not a substitute."
                hi="वास्तविक आपातकाल में हमेशा 112 पर कॉल करें — यह सहायक केवल एक पूरक उपकरण है, विकल्प नहीं।"
                hiClassName="block text-muted/80"
              />
            </div>
          </div>

          <div ref={scrollRef} className="mb-4 flex max-h-96 flex-col gap-3 overflow-y-auto">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`pop-in flex items-start gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.role === "assistant" && (
                  <div
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
                      m.isDangerAlert
                        ? "bg-red-500/15 text-red-400"
                        : "bg-warm-accent/15 text-warm-accent"
                    }`}
                  >
                    {m.isDangerAlert ? (
                      <AlertTriangle className="h-3.5 w-3.5" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                  </div>
                )}
                {m.isDangerAlert ? (
                  <div className="pop-in flex max-w-[85%] flex-col gap-3 rounded-lg border-2 border-red-500/60 bg-red-500/10 px-4 py-3">
                    <p className="flex items-center gap-2 text-sm font-semibold text-red-400">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      {m.content}
                    </p>
                    <a
                      href="tel:112"
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-red-600"
                    >
                      <PhoneCall className="h-4 w-4" />
                      <Bilingual en="Call 112 Now" hi="अभी 112 पर कॉल करें" />
                    </a>
                  </div>
                ) : (
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      m.role === "user"
                        ? "bg-warm-accent text-white"
                        : "border border-border bg-background text-foreground"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  </div>
                )}
                {m.role === "user" && (
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-warm-accent text-white">
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

          {error && (
            <div className="pop-in mb-4 flex items-center gap-2 rounded-lg border border-priority-high/30 bg-priority-high/10 px-3 py-2.5 text-sm text-priority-high">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={sendMessage} className="flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={pending}
              placeholder="Ask a safety question..."
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-warm-accent disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={pending || !input.trim()}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-warm-accent text-white transition-colors hover:bg-warm-accent/90 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
