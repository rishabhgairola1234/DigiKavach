"use client";

import { useRef } from "react";
import { ShieldCheck } from "lucide-react";
import { motionLevelForIntensity, MOTION_LEVEL_BAR_CLASSES } from "@/lib/motion-detection";

export type CameraRecording = {
  id: string;
  url: string | null;
  detected_objects: { label: string; timestamp: number }[];
  motion_timeline: { timestamp: number; intensity: number }[];
  key_moments: { timestamp: number; thumbnail_data_url: string; reason: string }[];
  duration_seconds: number;
  file_hash: string | null;
  created_at: string;
};

export function RecordingCard({ recording }: { recording: CameraRecording }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const distinctObjects = new Map<string, number>();
  for (const obj of recording.detected_objects) {
    distinctObjects.set(obj.label, (distinctObjects.get(obj.label) ?? 0) + 1);
  }

  function seekTo(timestamp: number) {
    if (videoRef.current) {
      videoRef.current.currentTime = timestamp;
      videoRef.current.play().catch(() => {
        // Autoplay can be blocked -- the officer can just press play manually.
      });
    }
  }

  return (
    <div className="rounded-lg border border-border bg-background-elevated p-4">
      {recording.url ? (
        <video ref={videoRef} controls src={recording.url} className="w-full rounded-lg" />
      ) : (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">
          Video link unavailable.
        </p>
      )}

      <p className="mt-3 text-xs text-muted">
        {new Date(recording.created_at).toLocaleString("en-IN", {
          dateStyle: "medium",
          timeStyle: "short",
        })}{" "}
        · {recording.duration_seconds.toFixed(0)}s
      </p>

      {recording.key_moments.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-medium text-foreground">
            Key moments ({recording.key_moments.length})
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {recording.key_moments.map((moment, i) => (
              <button
                key={i}
                onClick={() => seekTo(moment.timestamp)}
                title={`${moment.reason} — ${moment.timestamp.toFixed(1)}s`}
                className="group relative shrink-0 overflow-hidden rounded-md border border-border transition-all hover:border-accent/60 active:scale-[0.98]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={moment.thumbnail_data_url}
                  alt={moment.reason}
                  className="h-16 w-20 object-cover"
                />
                <span className="absolute bottom-0 left-0 right-0 bg-black/70 px-1 py-0.5 text-[10px] text-white">
                  {moment.timestamp.toFixed(0)}s
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {recording.motion_timeline.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-medium text-foreground">Motion over time</p>
          <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full">
            {recording.motion_timeline.map((reading, i) => (
              <span
                key={i}
                className={`h-full flex-1 ${MOTION_LEVEL_BAR_CLASSES[motionLevelForIntensity(reading.intensity)]}`}
              />
            ))}
          </div>
        </div>
      )}

      {distinctObjects.size > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-medium text-foreground">Objects detected</p>
          <div className="flex flex-wrap gap-1.5">
            {[...distinctObjects.entries()].map(([label, count]) => (
              <span
                key={label}
                className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-foreground"
              >
                {label} × {count}
              </span>
            ))}
          </div>
        </div>
      )}

      {recording.file_hash && (
        <div className="mt-3 rounded-lg border border-border bg-background p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-priority-low" />
            Integrity Hash (SHA-256)
          </p>
          <p className="mt-1 break-all font-mono text-[11px] text-muted">{recording.file_hash}</p>
          <p className="mt-1 text-[11px] text-muted">
            This hash can verify the recording has not been altered since capture.
          </p>
        </div>
      )}
    </div>
  );
}
