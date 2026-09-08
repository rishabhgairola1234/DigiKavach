"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { Bilingual } from "@/components/bilingual";

// The Web Speech API has no official TypeScript lib types and is still
// vendor-prefixed in some browsers -- kept loosely typed on purpose, same
// pragmatic approach used for other untyped browser/library boundaries in
// this app (coco-ssd, tesseract.js).
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: any) => void) | null; // eslint-disable-line @typescript-eslint/no-explicit-any
  onerror: ((event: any) => void) | null; // eslint-disable-line @typescript-eslint/no-explicit-any
  onend: (() => void) | null;
};

export function VoiceInputButton({
  currentValue,
  onChange,
}: {
  currentValue: string;
  onChange: (value: string) => void;
}) {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const baseTextRef = useRef("");
  const currentValueRef = useRef(currentValue);

  useEffect(() => {
    currentValueRef.current = currentValue;
  }, [currentValue]);

  useEffect(() => {
    const ctor =
      (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
        .SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
    setSupported(Boolean(ctor));

    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  function handleToggle() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const Ctor = (
      window as unknown as {
        SpeechRecognition?: new () => SpeechRecognitionLike;
        webkitSpeechRecognition?: new () => SpeechRecognitionLike;
      }
    ).SpeechRecognition ??
      (
        window as unknown as {
          webkitSpeechRecognition?: new () => SpeechRecognitionLike;
        }
      ).webkitSpeechRecognition;

    if (!Ctor) {
      setSupported(false);
      return;
    }

    setError(null);
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";

    // Voice input appends to whatever's already typed, rather than
    // overwriting it -- the officer/civilian can speak, then keep editing.
    baseTextRef.current = currentValueRef.current ? `${currentValueRef.current.trim()} ` : "";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += `${transcript} `;
        } else {
          interimText += transcript;
        }
      }
      if (finalText) baseTextRef.current += finalText;
      onChange(baseTextRef.current + interimText);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      console.error("[VoiceInput] Speech recognition error:", event.error);
      setError(
        event.error === "not-allowed" || event.error === "permission-denied"
          ? "Microphone access was denied."
          : "Voice input stopped due to an error."
      );
      setListening(false);
    };

    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  if (!supported) {
    return (
      <p className="text-xs text-muted">
        Voice input isn&apos;t supported in this browser — you can still type your description.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handleToggle}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all active:scale-[0.98] ${
          listening
            ? "border-warm-accent/60 bg-warm-accent/15 text-warm-accent"
            : "border-border bg-background text-muted hover:border-warm-accent/50 hover:text-warm-accent"
        }`}
      >
        {listening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
        {listening ? (
          <Bilingual en="Stop listening" hi="सुनना बंद करें" />
        ) : (
          <Bilingual en="Speak description" hi="बोलकर विवरण दें" />
        )}
      </button>
      {listening && (
        <span className="fade-in flex items-center gap-1.5 text-xs text-warm-accent">
          <span className="h-2 w-2 animate-pulse rounded-full bg-warm-accent" />
          Listening...
        </span>
      )}
      {error && <span className="fade-in text-xs text-priority-high">{error}</span>}
    </div>
  );
}
