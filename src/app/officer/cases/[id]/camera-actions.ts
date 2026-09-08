"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type DetectedObjectLog = { label: string; timestamp: number };
export type MotionReading = { timestamp: number; intensity: number };
export type KeyMoment = { timestamp: number; thumbnail_data_url: string; reason: string };

export type SaveCameraRecordingResult = { error: string | null };

export type SaveCameraRecordingParams = {
  complaintId: string;
  filePath: string;
  detectedObjects: DetectedObjectLog[];
  motionTimeline: MotionReading[];
  keyMoments: KeyMoment[];
  durationSeconds: number;
  fileHash: string;
};

export async function saveCameraRecording(
  params: SaveCameraRecordingParams
): Promise<SaveCameraRecordingResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "officer") {
    return { error: "Only officers can save camera recordings." };
  }

  const { error } = await supabase.from("camera_recordings").insert({
    complaint_id: params.complaintId,
    officer_id: user.id,
    file_path: params.filePath,
    detected_objects: params.detectedObjects,
    motion_timeline: params.motionTimeline,
    key_moments: params.keyMoments,
    duration_seconds: params.durationSeconds,
    file_hash: params.fileHash,
  });

  if (error) {
    console.error(
      `[saveCameraRecording] Failed to save recording for complaint ${params.complaintId}:`,
      error
    );
    return { error: "Failed to save recording. Please try again." };
  }

  revalidatePath(`/officer/cases/${params.complaintId}`);

  return { error: null };
}
