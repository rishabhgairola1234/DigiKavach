"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Camera, Video, Square, Loader2, AlertTriangle, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeTime } from "@/lib/time";
import { motionLevelForIntensity, type MotionLevel } from "@/lib/motion-detection";
import type { PlateMatch } from "@/lib/plate-matching";
import {
  saveCameraRecording,
  type DetectedObjectLog,
  type MotionReading,
  type KeyMoment,
} from "./camera-actions";
import { findCaseByPlate } from "./plate-actions";

// coco-ssd's prediction shape -- kept local since the package's own types
// aren't imported until the model is dynamically loaded in the browser.
type Detection = { class: string; score: number; bbox: [number, number, number, number] };
type CocoSsdModel = { detect: (input: HTMLVideoElement) => Promise<Detection[]> };

// tesseract.js's Worker shape, likewise kept local since it's only imported
// dynamically in the browser.
type OcrWorker = {
  recognize: (image: HTMLCanvasElement) => Promise<{ data: { text: string } }>;
  terminate: () => Promise<unknown>;
};

// Label text + its measured width, precomputed once per detection tick
// (every DETECTION_INTERVAL_MS) instead of on every rendered frame -- ctx.font
// assignment and ctx.measureText() are the two priciest parts of drawing a
// box, and predictions only change this often anyway.
type LabeledPrediction = {
  bbox: [number, number, number, number];
  label: string;
  labelWidth: number;
};

type CameraState =
  | "idle"
  | "loading-model"
  | "requesting-camera"
  | "live"
  | "recording"
  | "saving"
  | "error";

const DETECTION_INTERVAL_MS = 1500;
const MOTION_INTERVAL_MS = 150;
const MOTION_LOG_INTERVAL_MS = 500;
const MOTION_SAMPLE_WIDTH = 80;
const MOTION_SAMPLE_HEIGHT = 60;
const BOX_LABEL_FONT = "13px sans-serif";
const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  video: { width: { ideal: 640 }, height: { ideal: 480 } },
};

// Plate OCR is the most expensive per-tick operation here, so it runs far
// less often than detection/motion -- every 2.5s, on a small downscaled
// frame, with a re-entrancy guard so a slow pass never overlaps the next.
const OCR_INTERVAL_MS = 2500;
const OCR_SAMPLE_WIDTH = 480;
const OCR_SAMPLE_HEIGHT = 360;

// Key-moment thumbnails: small + compressed, and rate-limited so a burst of
// motion or several new object classes in quick succession can't flood
// key_moments with near-duplicate captures.
const KEY_MOMENT_MIN_GAP_MS = 1500;
const NEW_OBJECT_WINDOW_MS = 5000;
const THUMBNAIL_WIDTH = 160;
const THUMBNAIL_HEIGHT = 120;

export function CameraIntelligencePanel({
  complaintId,
  children,
}: {
  complaintId: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [state, setState] = useState<CameraState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [motionLevel, setMotionLevel] = useState<MotionLevel>("none");
  const [plateMatch, setPlateMatch] = useState<PlateMatch | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);
  const ocrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const thumbnailCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const modelRef = useRef<CocoSsdModel | null>(null);
  const ocrWorkerRef = useRef<OcrWorker | null>(null);
  const ocrRunningRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const labeledPredictionsRef = useRef<LabeledPrediction[]>([]);
  const prevFrameRef = useRef<Uint8ClampedArray | null>(null);
  const motionLevelRef = useRef<MotionLevel>("none");
  const wasHighMotionRef = useRef(false);

  const isRecordingRef = useRef(false);
  const recordingStartRef = useRef(0);
  const lastMotionLogRef = useRef(0);
  const lastKeyMomentTimeRef = useRef(0);
  const lastSeenClassRef = useRef<Map<string, number>>(new Map());
  const detectedObjectsLogRef = useRef<DetectedObjectLog[]>([]);
  const motionTimelineRef = useRef<MotionReading[]>([]);
  const keyMomentsRef = useRef<KeyMoment[]>([]);

  const animationFrameIdRef = useRef<number | null>(null);
  const detectionIntervalIdRef = useRef<number | null>(null);
  const motionIntervalIdRef = useRef<number | null>(null);
  const ocrIntervalIdRef = useRef<number | null>(null);
  const elapsedIntervalIdRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cleanup() {
    if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
    if (detectionIntervalIdRef.current) window.clearInterval(detectionIntervalIdRef.current);
    if (motionIntervalIdRef.current) window.clearInterval(motionIntervalIdRef.current);
    if (ocrIntervalIdRef.current) window.clearInterval(ocrIntervalIdRef.current);
    if (elapsedIntervalIdRef.current) window.clearInterval(elapsedIntervalIdRef.current);
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    prevFrameRef.current = null;
    ocrWorkerRef.current?.terminate();
    ocrWorkerRef.current = null;
  }

  function renderLoop() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas && video.readyState >= 2) {
      if (canvas.width !== video.videoWidth && video.videoWidth > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Boxes still get redrawn every frame (the video draw above erases
        // the whole canvas each time, so there's no way around that) -- but
        // the label text and its measured width are precomputed once per
        // detection tick in runDetectionLoop, not recalculated here.
        ctx.font = BOX_LABEL_FONT;
        for (const pred of labeledPredictionsRef.current) {
          const [x, y, w, h] = pred.bbox;
          ctx.strokeStyle = "#38bdf8";
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, w, h);

          ctx.fillStyle = "rgba(14, 165, 233, 0.9)";
          ctx.fillRect(x, Math.max(0, y - 18), pred.labelWidth + 8, 18);
          ctx.fillStyle = "#0f172a";
          ctx.fillText(pred.label, x + 4, Math.max(13, y - 5));
        }

        const level = motionLevelRef.current;
        if (level === "moderate") {
          ctx.strokeStyle = "rgba(245, 158, 11, 0.8)";
          ctx.lineWidth = 10;
          ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
        } else if (level === "high") {
          ctx.fillStyle = "rgba(239, 68, 68, 0.22)";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.strokeStyle = "rgba(239, 68, 68, 0.9)";
          ctx.lineWidth = 12;
          ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);
        }
      }
    }
    animationFrameIdRef.current = requestAnimationFrame(renderLoop);
  }

  // Captures a small compressed JPEG of the current composited canvas (video
  // + boxes + motion overlay, exactly as recorded) and appends it to this
  // clip's key moments, unless one was already captured too recently.
  function maybeCaptureKeyMoment(reason: string, timestampSeconds: number) {
    const now = performance.now();
    if (now - lastKeyMomentTimeRef.current < KEY_MOMENT_MIN_GAP_MS) return;
    if (!canvasRef.current) return;
    lastKeyMomentTimeRef.current = now;

    if (!thumbnailCanvasRef.current) {
      thumbnailCanvasRef.current = document.createElement("canvas");
    }
    const thumb = thumbnailCanvasRef.current;
    thumb.width = THUMBNAIL_WIDTH;
    thumb.height = THUMBNAIL_HEIGHT;
    const tctx = thumb.getContext("2d");
    if (!tctx) return;

    tctx.drawImage(canvasRef.current, 0, 0, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);
    keyMomentsRef.current.push({
      timestamp: Number(timestampSeconds.toFixed(2)),
      thumbnail_data_url: thumb.toDataURL("image/jpeg", 0.5),
      reason,
    });
  }

  async function runDetectionLoop() {
    const video = videoRef.current;
    const model = modelRef.current;
    if (!video || !model || video.readyState < 2) return;

    try {
      const predictions = await model.detect(video);

      const ctx = canvasRef.current?.getContext("2d");
      if (ctx) ctx.font = BOX_LABEL_FONT;
      labeledPredictionsRef.current = predictions.map((pred) => {
        const label = `${pred.class} ${(pred.score * 100).toFixed(0)}%`;
        return {
          bbox: pred.bbox,
          label,
          labelWidth: ctx ? ctx.measureText(label).width : label.length * 7,
        };
      });

      if (isRecordingRef.current) {
        const nowMs = performance.now();
        const t = (nowMs - recordingStartRef.current) / 1000;

        for (const p of predictions) {
          detectedObjectsLogRef.current.push({ label: p.class, timestamp: Number(t.toFixed(2)) });

          const lastSeen = lastSeenClassRef.current.get(p.class);
          const isNewOrStale = lastSeen === undefined || nowMs - lastSeen > NEW_OBJECT_WINDOW_MS;
          if (isNewOrStale) {
            maybeCaptureKeyMoment(`New object detected: ${p.class}`, t);
          }
          lastSeenClassRef.current.set(p.class, nowMs);
        }
      }
    } catch (err) {
      console.error("[CameraIntelligence] Detection error:", err);
    }
  }

  function runMotionLoop() {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;

    if (!offscreenRef.current) {
      offscreenRef.current = document.createElement("canvas");
    }
    const offscreen = offscreenRef.current;
    offscreen.width = MOTION_SAMPLE_WIDTH;
    offscreen.height = MOTION_SAMPLE_HEIGHT;
    const octx = offscreen.getContext("2d", { willReadFrequently: true });
    if (!octx) return;

    octx.drawImage(video, 0, 0, MOTION_SAMPLE_WIDTH, MOTION_SAMPLE_HEIGHT);
    const frame = octx.getImageData(0, 0, MOTION_SAMPLE_WIDTH, MOTION_SAMPLE_HEIGHT).data;
    const prev = prevFrameRef.current;

    if (prev) {
      let diffSum = 0;
      for (let i = 0; i < frame.length; i += 4) {
        diffSum += Math.abs(frame[i] - prev[i]);
      }
      const intensity = diffSum / (255 * MOTION_SAMPLE_WIDTH * MOTION_SAMPLE_HEIGHT);
      const level = motionLevelForIntensity(intensity);
      motionLevelRef.current = level;
      setMotionLevel(level);

      if (isRecordingRef.current) {
        const now = performance.now();
        const t = (now - recordingStartRef.current) / 1000;

        if (level === "high" && !wasHighMotionRef.current) {
          maybeCaptureKeyMoment("High motion detected", t);
        }
        wasHighMotionRef.current = level === "high";

        if (now - lastMotionLogRef.current >= MOTION_LOG_INTERVAL_MS) {
          motionTimelineRef.current.push({
            timestamp: Number(t.toFixed(2)),
            intensity: Number(intensity.toFixed(4)),
          });
          lastMotionLogRef.current = now;
        }
      }
    }

    prevFrameRef.current = frame;
  }

  async function runOcrLoop() {
    const video = videoRef.current;
    const worker = ocrWorkerRef.current;
    if (!video || !worker || video.readyState < 2 || ocrRunningRef.current) return;

    ocrRunningRef.current = true;
    try {
      if (!ocrCanvasRef.current) {
        ocrCanvasRef.current = document.createElement("canvas");
        ocrCanvasRef.current.width = OCR_SAMPLE_WIDTH;
        ocrCanvasRef.current.height = OCR_SAMPLE_HEIGHT;
      }
      const ocrCanvas = ocrCanvasRef.current;
      const octx = ocrCanvas.getContext("2d");
      if (!octx) return;
      octx.drawImage(video, 0, 0, OCR_SAMPLE_WIDTH, OCR_SAMPLE_HEIGHT);

      const result = await worker.recognize(ocrCanvas);
      const candidates = result.data.text
        .split(/\s+/)
        .map((t) => t.trim())
        .filter(Boolean);

      if (candidates.length > 0) {
        const match = await findCaseByPlate(candidates);
        if (match) setPlateMatch(match);
      }
    } catch (err) {
      console.error("[CameraIntelligence] Plate OCR error:", err);
    } finally {
      ocrRunningRef.current = false;
    }
  }

  async function handleActivate() {
    setErrorMessage(null);
    setState("loading-model");

    try {
      const [tf, coco] = await Promise.all([
        import("@tensorflow/tfjs"),
        import("@tensorflow-models/coco-ssd"),
      ]);

      // Inference performance depends heavily on which backend tf.js picks --
      // WebGL runs on the GPU and is dramatically faster than the plain-JS
      // CPU backend for a model like this. Request it explicitly rather than
      // trusting whatever tf.js would have auto-selected.
      let webglReady = false;
      try {
        webglReady = await tf.setBackend("webgl");
      } catch (err) {
        console.error("[CameraIntelligence] Failed to initialize the webgl backend:", err);
      }

      if (!webglReady) {
        console.warn(
          "[CameraIntelligence] WebGL backend unavailable -- falling back to CPU. " +
            "Object detection will be noticeably slower on this device/browser."
        );
        await tf.setBackend("cpu");
      }

      await tf.ready();
      console.log(`[CameraIntelligence] TensorFlow.js backend in use: ${tf.getBackend()}`);

      // "lite_mobilenet_v2" trades a bit of accuracy for noticeably faster
      // inference than the default base model -- worth it given detection
      // already only runs once every DETECTION_INTERVAL_MS anyway.
      modelRef.current = (await coco.load({ base: "lite_mobilenet_v2" })) as unknown as CocoSsdModel;
    } catch (err) {
      console.error("[CameraIntelligence] Failed to load detection model:", err);
      setErrorMessage("Failed to load the object detection model. Please try again.");
      setState("error");
      return;
    }

    // Plate OCR is a supplementary aid, not core functionality -- if it fails
    // to initialize, log it and continue without it rather than blocking
    // object detection and motion tracking, which already loaded fine.
    try {
      const { createWorker } = await import("tesseract.js");
      ocrWorkerRef.current = (await createWorker("eng")) as unknown as OcrWorker;
    } catch (err) {
      console.error(
        "[CameraIntelligence] Failed to initialize the plate-reading OCR worker -- " +
          "continuing without live plate cross-referencing:",
        err
      );
    }

    setState("requesting-camera");

    try {
      const stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      console.error("[CameraIntelligence] Camera permission error:", err);
      setErrorMessage(
        "Camera access was denied or unavailable. Please allow camera permission and try again."
      );
      setState("error");
      return;
    }

    setState("live");
    animationFrameIdRef.current = requestAnimationFrame(renderLoop);
    detectionIntervalIdRef.current = window.setInterval(runDetectionLoop, DETECTION_INTERVAL_MS);
    motionIntervalIdRef.current = window.setInterval(runMotionLoop, MOTION_INTERVAL_MS);
    if (ocrWorkerRef.current) {
      ocrIntervalIdRef.current = window.setInterval(runOcrLoop, OCR_INTERVAL_MS);
    }
  }

  function handleDeactivate() {
    cleanup();
    labeledPredictionsRef.current = [];
    setMotionLevel("none");
    setPlateMatch(null);
    setState("idle");
  }

  function handleStartRecording() {
    if (!canvasRef.current) return;

    detectedObjectsLogRef.current = [];
    motionTimelineRef.current = [];
    keyMomentsRef.current = [];
    lastSeenClassRef.current = new Map();
    wasHighMotionRef.current = false;
    lastKeyMomentTimeRef.current = 0;
    recordingStartRef.current = performance.now();
    lastMotionLogRef.current = performance.now();
    isRecordingRef.current = true;

    const stream = canvasRef.current.captureStream(30);
    const mimeType =
      ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((t) =>
        MediaRecorder.isTypeSupported(t)
      ) ?? "video/webm";

    const recorder = new MediaRecorder(stream, { mimeType });
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = handleRecordingStopped;
    recorder.start();
    recorderRef.current = recorder;

    setElapsedSeconds(0);
    elapsedIntervalIdRef.current = window.setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    setState("recording");
  }

  function handleStopRecording() {
    isRecordingRef.current = false;
    if (elapsedIntervalIdRef.current) window.clearInterval(elapsedIntervalIdRef.current);
    recorderRef.current?.stop();
  }

  async function handleRecordingStopped() {
    setState("saving");

    const durationSeconds = (performance.now() - recordingStartRef.current) / 1000;
    const blob = new Blob(chunksRef.current, { type: "video/webm" });
    const path = `${complaintId}/${crypto.randomUUID()}.webm`;

    // SHA-256 over the exact bytes about to be uploaded -- computed before
    // upload so the stored hash always matches what's in storage, letting
    // anyone later verify the recording hasn't been altered since capture.
    const digestBuffer = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
    const fileHash = Array.from(new Uint8Array(digestBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const supabase = createClient();
    const { error: uploadError } = await supabase.storage
      .from("camera-recordings")
      .upload(path, blob, { contentType: "video/webm" });

    if (uploadError) {
      console.error("[CameraIntelligence] Upload failed:", uploadError);
      setErrorMessage("Failed to upload the recording. Please try again.");
      setState("live");
      return;
    }

    const result = await saveCameraRecording({
      complaintId,
      filePath: path,
      detectedObjects: detectedObjectsLogRef.current,
      motionTimeline: motionTimelineRef.current,
      keyMoments: keyMomentsRef.current,
      durationSeconds: Number(durationSeconds.toFixed(1)),
      fileHash,
    });

    if (result.error) {
      setErrorMessage(result.error);
      setState("live");
      return;
    }

    setState("live");
    router.refresh();
  }

  const isLoading = state === "loading-model" || state === "requesting-camera";
  const isCameraOn = state === "live" || state === "recording" || state === "saving";

  return (
    <section className="mt-8 rounded-xl border border-border bg-background p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-strong">
            <Camera className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Camera Intelligence</h2>
            <p className="text-xs text-muted">
              Live object, motion &amp; plate detection from a connected camera
            </p>
          </div>
        </div>

        {state === "idle" || state === "error" ? (
          <button
            onClick={handleActivate}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-strong"
          >
            <Camera className="h-3.5 w-3.5" />
            Activate Camera
          </button>
        ) : (
          <button
            onClick={handleDeactivate}
            disabled={state === "recording" || state === "saving"}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background-elevated px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-priority-high/50 disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" />
            Deactivate
          </button>
        )}
      </div>

      {isLoading && (
        <p className="fade-in flex items-center gap-2 text-xs text-muted">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {state === "loading-model"
            ? "Loading object detection model..."
            : "Requesting camera access..."}
        </p>
      )}

      {state === "error" && errorMessage && (
        <div className="pop-in flex items-center gap-2 rounded-lg border border-priority-high/30 bg-priority-high/10 px-3 py-2 text-sm text-priority-high">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {errorMessage}
        </div>
      )}

      {/* Always visually hidden -- it's just the raw camera source. The
          canvas below is the actual composited output (detections + motion
          overlay baked in) that the officer sees and that gets recorded. */}
      <video ref={videoRef} muted playsInline className="hidden" />

      {isCameraOn && (
        <div className="pop-in flex flex-col gap-3">
          <div className="overflow-hidden rounded-lg border border-border">
            <canvas ref={canvasRef} className="block w-full" />
          </div>

          {plateMatch && (
            <div className="pop-in flex items-start gap-2 rounded-lg border border-priority-high/40 bg-priority-high/10 px-3 py-2.5 text-sm text-priority-high">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="flex-1">
                Plate <span className="font-semibold">{plateMatch.matchedPlate}</span> detected —
                matches{" "}
                <Link
                  href={`/officer/cases/${plateMatch.complaintId}`}
                  className="font-medium underline transition-colors hover:text-priority-high/80"
                >
                  &quot;{plateMatch.title}&quot;
                </Link>{" "}
                (filed {formatRelativeTime(plateMatch.createdAt)})
              </p>
              <button
                onClick={() => setPlateMatch(null)}
                className="shrink-0 text-priority-high/70 transition-colors hover:text-priority-high"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {errorMessage && (
            <p className="pop-in text-xs text-priority-high">{errorMessage}</p>
          )}

          {state !== "recording" && (
            <p className="text-xs italic text-muted">
              Recording will be saved as case evidence — ensure appropriate
              consent has been obtained before recording people.
            </p>
          )}

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted">
              Motion:{" "}
              <span
                className={
                  motionLevel === "high"
                    ? "font-medium text-priority-high"
                    : motionLevel === "moderate"
                      ? "font-medium text-priority-medium"
                      : "text-muted"
                }
              >
                {motionLevel === "none" ? "Minimal" : motionLevel === "moderate" ? "Moderate" : "High"}
              </span>
            </span>

            {state === "recording" ? (
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-xs font-medium text-priority-high">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-priority-high" />
                  REC {formatElapsed(elapsedSeconds)}
                </span>
                <button
                  onClick={handleStopRecording}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-priority-high px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-priority-high/90"
                >
                  <Square className="h-3.5 w-3.5" />
                  Stop Recording
                </button>
              </div>
            ) : state === "saving" ? (
              <span className="flex items-center gap-1.5 text-xs text-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Saving recording...
              </span>
            ) : (
              <button
                onClick={handleStartRecording}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-strong"
              >
                <Video className="h-3.5 w-3.5" />
                Start Recording
              </button>
            )}
          </div>
        </div>
      )}

      {children}
    </section>
  );
}

function formatElapsed(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
