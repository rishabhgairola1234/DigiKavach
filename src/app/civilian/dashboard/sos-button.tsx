"use client";

import { useState } from "react";
import { Siren, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { sendSosAlert } from "./sos-actions";
import { Bilingual } from "@/components/bilingual";

type SosState = "idle" | "locating" | "sending" | "sent" | "error";

export function SosButton() {
  const [state, setState] = useState<SosState>("idle");
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    setState("locating");

    if (!("geolocation" in navigator)) {
      setError(
        "Your browser doesn't support location sharing. Please call emergency services directly."
      );
      setState("error");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setState("sending");
        const result = await sendSosAlert(
          position.coords.latitude,
          position.coords.longitude
        );
        if (result.error) {
          setError(result.error);
          setState("error");
        } else {
          setState("sent");
        }
      },
      (geoError) => {
        setError(
          geoError.code === geoError.PERMISSION_DENIED
            ? "Location access was denied. Please enable location permissions and try again, or call emergency services directly."
            : "Couldn't get your location. Please try again or call emergency services directly."
        );
        setState("error");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  if (state === "sent") {
    return (
      <div className="pop-in flex flex-col items-center gap-1.5 rounded-2xl border border-priority-low/40 bg-priority-low/10 px-6 py-5 text-center">
        <CheckCircle2 className="h-8 w-8 text-priority-low" />
        <Bilingual
          as="p"
          en="Alert sent — help is on the way"
          hi="अलर्ट भेजा गया — मदद रास्ते में है"
          className="font-semibold text-foreground"
          hiClassName="block text-xs font-normal text-muted"
        />
        <p className="text-sm text-muted">
          Your location has been shared with the response team.
        </p>
        <button
          onClick={() => setState("idle")}
          className="mt-1 text-xs text-muted underline transition-all hover:text-foreground active:scale-[0.98]"
        >
          <Bilingual en="Send another alert" hi="एक और अलर्ट भेजें" />
        </button>
      </div>
    );
  }

  const isBusy = state === "locating" || state === "sending";

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={handleClick}
        disabled={isBusy}
        className={`flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-b from-red-500 to-red-700 text-white shadow-lg shadow-red-950/40 transition-transform hover:scale-105 disabled:opacity-80 disabled:hover:scale-100 ${
          state === "idle" ? "sos-pulse" : ""
        }`}
      >
        {isBusy ? (
          <Loader2 className="h-10 w-10 animate-spin" />
        ) : (
          <Siren className="h-10 w-10" />
        )}
      </button>

      <div className="min-h-11 text-center">
        {state === "locating" || state === "sending" ? (
          <p className="text-sm font-semibold text-foreground">
            {state === "locating" ? "Getting your location..." : "Sending alert..."}
          </p>
        ) : (
          <Bilingual
            as="p"
            en="SOS Alert"
            hi="एसओएस अलर्ट"
            className="text-sm font-semibold text-foreground"
            hiClassName="block text-xs font-normal text-muted"
          />
        )}
        {state === "idle" && (
          <p className="text-xs text-muted">
            Notifies the response team with your location
          </p>
        )}
      </div>

      {state === "error" && (
        <div className="pop-in flex max-w-xs flex-col items-center gap-2 rounded-lg border border-priority-high/30 bg-priority-high/10 px-4 py-3 text-center">
          <AlertTriangle className="h-4 w-4 shrink-0 text-priority-high" />
          <p className="text-xs text-priority-high">{error}</p>
          <button
            onClick={handleClick}
            className="text-xs font-medium text-priority-high underline transition-all hover:text-priority-high/80 active:scale-[0.98]"
          >
            <Bilingual en="Try again" hi="पुनः प्रयास करें" />
          </button>
        </div>
      )}
    </div>
  );
}
