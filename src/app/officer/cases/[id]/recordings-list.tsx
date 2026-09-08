import { Film } from "lucide-react";
import { RecordingCard, type CameraRecording } from "./recording-card";

export type { CameraRecording };

export function RecordingsList({ recordings }: { recordings: CameraRecording[] }) {
  if (recordings.length === 0) return null;

  return (
    <div className="mt-6 flex flex-col gap-5">
      <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
        <Film className="h-3.5 w-3.5" />
        Saved Recordings ({recordings.length})
      </h3>

      {recordings.map((recording) => (
        <RecordingCard key={recording.id} recording={recording} />
      ))}
    </div>
  );
}
