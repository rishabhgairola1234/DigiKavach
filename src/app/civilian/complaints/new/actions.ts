"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type FileComplaintState = { error: string | null };

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
]);

export async function fileComplaint(
  _prevState: FileComplaintState,
  formData: FormData
): Promise<FileComplaintState> {
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const incidentDatetimeRaw = String(formData.get("incidentDatetime") || "");
  const location = String(formData.get("location") || "").trim();
  const files = formData
    .getAll("files")
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (!title || !description || !incidentDatetimeRaw || !location) {
    return { error: "Title, description, incident date/time, and location are all required." };
  }

  const incidentDate = new Date(incidentDatetimeRaw);
  if (Number.isNaN(incidentDate.getTime())) {
    return { error: "Incident date/time is invalid." };
  }

  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) {
      return { error: `"${file.name}" is larger than the 10MB limit.` };
    }
    if (!ALLOWED_FILE_TYPES.has(file.type)) {
      return { error: `"${file.name}" is not a supported file type. Upload images or PDFs only.` };
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in to file a complaint." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "civilian") {
    return { error: "Only civilian accounts can file complaints." };
  }

  const { data: complaint, error: insertError } = await supabase
    .from("complaints")
    .insert({
      civilian_id: user.id,
      title,
      description,
      incident_datetime: incidentDate.toISOString(),
      location,
    })
    .select("id")
    .single();

  if (insertError || !complaint) {
    console.error("[fileComplaint] Failed to insert complaint:", insertError);
    return { error: "Something went wrong while saving your complaint. Please try again." };
  }

  for (const file of files) {
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const path = `${user.id}/${complaint.id}/${crypto.randomUUID()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("evidence")
      .upload(path, file, { contentType: file.type });

    if (uploadError) {
      console.error(`[fileComplaint] Failed to upload evidence "${file.name}":`, uploadError);
      continue;
    }

    const { error: evidenceInsertError } = await supabase.from("evidence").insert({
      complaint_id: complaint.id,
      file_path: path,
      file_type: file.type,
    });

    if (evidenceInsertError) {
      console.error(
        `[fileComplaint] Uploaded "${file.name}" but failed to link it to the complaint:`,
        evidenceInsertError
      );
    }
  }

  redirect("/civilian/dashboard?filed=1");
}
