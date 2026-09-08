"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type AddEvidenceResult = { error: string | null };

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
]);

export async function addComplaintEvidence(
  complaintId: string,
  formData: FormData
): Promise<AddEvidenceResult> {
  const files = formData
    .getAll("files")
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (files.length === 0) {
    return { error: "Choose at least one file to upload." };
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
    return { error: "You must be logged in." };
  }

  // Re-fetch and re-check ownership server-side -- never trust that the
  // complaintId argument actually belongs to this civilian just because the
  // client sent it. RLS backs this up too, but this gives a clean error
  // instead of a raw permission-denied.
  const { data: complaint } = await supabase
    .from("complaints")
    .select("id, civilian_id")
    .eq("id", complaintId)
    .single();

  if (!complaint || complaint.civilian_id !== user.id) {
    return { error: "Complaint not found." };
  }

  let uploadedCount = 0;

  for (const file of files) {
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const path = `${user.id}/${complaintId}/${crypto.randomUUID()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("evidence")
      .upload(path, file, { contentType: file.type });

    if (uploadError) {
      console.error(`[addComplaintEvidence] Failed to upload "${file.name}":`, uploadError);
      continue;
    }

    const { error: evidenceInsertError } = await supabase.from("evidence").insert({
      complaint_id: complaintId,
      file_path: path,
      file_type: file.type,
    });

    if (evidenceInsertError) {
      console.error(
        `[addComplaintEvidence] Uploaded "${file.name}" but failed to link it:`,
        evidenceInsertError
      );
      continue;
    }

    uploadedCount++;
  }

  if (uploadedCount === 0) {
    return { error: "Failed to upload evidence. Please try again." };
  }

  revalidatePath(`/civilian/complaints/${complaintId}`);

  return { error: null };
}
