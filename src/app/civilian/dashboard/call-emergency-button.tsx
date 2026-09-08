"use client";

import { useState } from "react";
import { PhoneCall, Loader2 } from "lucide-react";
import { Bilingual } from "@/components/bilingual";

type CallState = "idle" | "connecting";

const CONNECT_DELAY_MS = 1800;

// No backend involved -- this just delays the tel: navigation slightly so the
// demo has a visible "Connecting..." moment instead of an instant, silent
// jump to the dialer. Styled as an outline (not solid/pulsing) red button so
// it reads as urgent but clearly secondary to the SOS button next to it.
export function CallEmergencyButton() {
  const [state, setState] = useState<CallState>("idle");

  function handleClick() {
    if (state === "connecting") return;
    setState("connecting");

    setTimeout(() => {
      window.location.href = "tel:112";
      setState("idle");
    }, CONNECT_DELAY_MS);
  }

  const isConnecting = state === "connecting";

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={handleClick}
        disabled={isConnecting}
        className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-red-500/60 text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300 disabled:opacity-80"
      >
        {isConnecting ? (
          <Loader2 className="h-8 w-8 animate-spin" />
        ) : (
          <PhoneCall className="h-8 w-8" />
        )}
      </button>
      <div className="text-center">
        {isConnecting ? (
          <p className="text-sm font-semibold text-foreground">Connecting to 112...</p>
        ) : (
          <Bilingual
            as="p"
            en="Call 112"
            hi="112 पर कॉल करें"
            className="text-sm font-semibold text-foreground"
            hiClassName="block text-xs font-normal text-muted"
          />
        )}
        {!isConnecting && (
          <p className="text-xs text-muted">Directly calls emergency services</p>
        )}
      </div>
    </div>
  );
}
