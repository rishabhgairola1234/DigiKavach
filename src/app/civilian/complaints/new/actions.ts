"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { extractComplaintData } from "@/lib/gemini/extract-complaint";
import { detectAndTranslateDescription } from "@/lib/gemini/translate-description";
import { findLikelyDuplicate } from "@/lib/duplicate-detection";
import { geocodeLocation } from "@/lib/geocoding";

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

  // Translation and geocoding are independent of each other -- run together
  // rather than adding one's latency on top of the other. Both are
  // best-effort: a failed geocode just means this complaint won't appear on
  // the public safety map, same fail-safe pattern as translation/extraction.
  const [translation, geocoded] = await Promise.all([
    detectAndTranslateDescription(description),
    geocodeLocation(location),
  ]);

  const englishDescription =
    translation && !translation.isEnglish ? translation.translatedText : description;
  const originalLanguage = translation && !translation.isEnglish ? translation.language : null;
  const originalDescription = translation && !translation.isEnglish ? description : null;

  const { data: complaint, error: insertError } = await supabase
    .from("complaints")
    .insert({
      civilian_id: user.id,
      title,
      description: englishDescription,
      original_language: originalLanguage,
      original_description: originalDescription,
      incident_datetime: incidentDate.toISOString(),
      location,
      latitude: geocoded?.latitude ?? null,
      longitude: geocoded?.longitude ?? null,
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

  // AI extraction runs after the complaint is safely saved, and its failure
  // (missing key, network error, bad response) must never block filing --
  // extractComplaintData already swallows its own errors and returns null.
  const extractedData = await extractComplaintData(title, englishDescription);

  if (extractedData) {
    console.log(
      `[fileComplaint] AI extraction for complaint ${complaint.id}:`,
      JSON.stringify(extractedData, null, 2)
    );

    const { error: extractedDataUpdateError } = await supabase
      .from("complaints")
      .update({ extracted_data: extractedData })
      .eq("id", complaint.id);

    if (extractedDataUpdateError) {
      console.error(
        `[fileComplaint] Extracted data but failed to save it on complaint ${complaint.id}:`,
        extractedDataUpdateError
      );
    }
  } else {
    console.log(
      `[fileComplaint] No AI extraction available for complaint ${complaint.id} (see logs above for why).`
    );
  }

  redirect("/civilian/dashboard?filed=1");
}

export type DuplicateCheckResult = {
  duplicate: { title: string; createdAt: string } | null;
};

/**
 * Pure keyword-overlap check against this civilian's own last-24h complaints
 * -- no AI call, deterministic. Called from the filing form as the officer
 * fills in title/description, purely informational: never blocks submission.
 */
export async function checkForDuplicateComplaint(
  title: string,
  description: string,
  location: string
): Promise<DuplicateCheckResult> {
  if (!title.trim() || !description.trim()) {
    return { duplicate: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { duplicate: null };
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: recentComplaints } = await supabase
    .from("complaints")
    .select("id, title, description, location, created_at")
    .eq("civilian_id", user.id)
    .gte("created_at", since);

  const match = findLikelyDuplicate(recentComplaints ?? [], title, description, location);

  if (!match) {
    return { duplicate: null };
  }

  return { duplicate: { title: match.title, createdAt: match.created_at } };
}
