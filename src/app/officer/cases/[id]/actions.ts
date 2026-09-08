"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { askCaseCopilot } from "@/lib/gemini/case-copilot";
import { generateFirDraft } from "@/lib/gemini/generate-fir";
import { suggestLegalSections, type SuggestedLegalSection } from "@/lib/gemini/suggest-legal-sections";
import { checkEvidenceSufficiency } from "@/lib/gemini/evidence-sufficiency";
import { suggestNextSteps } from "@/lib/gemini/next-steps";
import type { ComplaintStatus, ExtractedComplaintData } from "@/lib/complaints";

export type UpdateStatusResult = { error: string | null };

export async function updateComplaintStatus(
  complaintId: string,
  status: ComplaintStatus
): Promise<UpdateStatusResult> {
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
    return { error: "Only officers can update case status." };
  }

  const { error } = await supabase
    .from("complaints")
    .update({ status })
    .eq("id", complaintId);

  if (error) {
    console.error(`[updateComplaintStatus] Failed to update complaint ${complaintId}:`, error);
    return { error: "Failed to update status. Please try again." };
  }

  revalidatePath(`/officer/cases/${complaintId}`);
  revalidatePath("/officer/dashboard");

  return { error: null };
}

export type AskCopilotResult = { answer: string | null; error: string | null };

export async function askCopilot(
  complaintId: string,
  question: string
): Promise<AskCopilotResult> {
  const trimmedQuestion = question.trim();
  if (!trimmedQuestion) {
    return { answer: null, error: "Enter a question first." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { answer: null, error: "You must be logged in." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "officer") {
    return { answer: null, error: "Only officers can use the Investigation Copilot." };
  }

  const { data: complaint } = await supabase
    .from("complaints")
    .select("title, description, status, extracted_data")
    .eq("id", complaintId)
    .single();

  if (!complaint) {
    return { answer: null, error: "Case not found." };
  }

  const answer = await askCaseCopilot(
    {
      title: complaint.title,
      description: complaint.description,
      status: complaint.status as ComplaintStatus,
      extractedData: complaint.extracted_data as ExtractedComplaintData | null,
    },
    trimmedQuestion
  );

  if (!answer) {
    return {
      answer: null,
      error: "The Investigation Copilot couldn't respond right now. Please try again.",
    };
  }

  return { answer, error: null };
}

export type GenerateFirResult = { draft: string | null; error: string | null };

export async function generateCaseFir(complaintId: string): Promise<GenerateFirResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { draft: null, error: "You must be logged in." };
  }

  const { data: officerProfile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (officerProfile?.role !== "officer") {
    return { draft: null, error: "Only officers can generate an FIR draft." };
  }

  const { data: complaint } = await supabase
    .from("complaints")
    .select("title, description, incident_datetime, location, extracted_data, civilian_id")
    .eq("id", complaintId)
    .single();

  if (!complaint) {
    return { draft: null, error: "Case not found." };
  }

  const { data: civilianProfile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", complaint.civilian_id)
    .single();

  const extractedData = complaint.extracted_data as ExtractedComplaintData | null;

  const draft = await generateFirDraft({
    title: complaint.title,
    description: complaint.description,
    incidentDatetime: complaint.incident_datetime,
    location: complaint.location,
    category: extractedData?.category ?? null,
    extractedData,
    complainantName: civilianProfile?.full_name || civilianProfile?.email || "Unknown",
    complainantContact: civilianProfile?.email || "[Not recorded]",
    investigatingOfficer: officerProfile?.full_name || user.email || "[Not recorded]",
  });

  if (!draft) {
    return {
      draft: null,
      error: "The FIR draft couldn't be generated right now. Please try again.",
    };
  }

  return { draft, error: null };
}

/**
 * Suggested legal sections are a supplementary aid, not core functionality --
 * this deliberately returns no error string. A denied/unauthenticated caller
 * or a failed Gemini call both just get `null`, and the panel shows nothing
 * rather than an error message.
 */
export async function suggestCaseLegalSections(
  complaintId: string
): Promise<SuggestedLegalSection[] | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "officer") return null;

  const { data: complaint } = await supabase
    .from("complaints")
    .select("description, extracted_data")
    .eq("id", complaintId)
    .single();

  if (!complaint) return null;

  const extractedData = complaint.extracted_data as ExtractedComplaintData | null;

  return suggestLegalSections(extractedData?.category ?? null, complaint.description, extractedData);
}

export type AddNoteResult = { error: string | null };

export async function addOfficerNote(
  complaintId: string,
  noteText: string
): Promise<AddNoteResult> {
  const trimmed = noteText.trim();
  if (!trimmed) {
    return { error: "Note can't be empty." };
  }

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
    return { error: "Only officers can add case notes." };
  }

  const { error } = await supabase.from("officer_notes").insert({
    complaint_id: complaintId,
    officer_id: user.id,
    note_text: trimmed,
  });

  if (error) {
    console.error(`[addOfficerNote] Failed to add note for complaint ${complaintId}:`, error);
    return { error: "Failed to save note. Please try again." };
  }

  revalidatePath(`/officer/cases/${complaintId}`);

  return { error: null };
}

export type CheckEvidenceSufficiencyResult = { items: string[] | null; error: string | null };

export async function checkCaseEvidenceSufficiency(
  complaintId: string
): Promise<CheckEvidenceSufficiencyResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { items: null, error: "You must be logged in." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "officer") {
    return { items: null, error: "Only officers can check evidence sufficiency." };
  }

  const { data: complaint } = await supabase
    .from("complaints")
    .select("description, extracted_data")
    .eq("id", complaintId)
    .single();

  if (!complaint) {
    return { items: null, error: "Case not found." };
  }

  const { count: evidenceCount } = await supabase
    .from("evidence")
    .select("*", { count: "exact", head: true })
    .eq("complaint_id", complaintId);

  const extractedData = complaint.extracted_data as ExtractedComplaintData | null;

  const items = await checkEvidenceSufficiency({
    description: complaint.description,
    category: extractedData?.category ?? null,
    extractedData,
    evidenceCount: evidenceCount ?? 0,
  });

  if (!items) {
    return {
      items: null,
      error: "Couldn't check evidence sufficiency right now. Please try again.",
    };
  }

  return { items, error: null };
}

export type SuggestNextStepsResult = { steps: string[] | null; error: string | null };

export async function suggestCaseNextSteps(complaintId: string): Promise<SuggestNextStepsResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { steps: null, error: "You must be logged in." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "officer") {
    return { steps: null, error: "Only officers can suggest next steps." };
  }

  const { data: complaint } = await supabase
    .from("complaints")
    .select("description, location, extracted_data")
    .eq("id", complaintId)
    .single();

  if (!complaint) {
    return { steps: null, error: "Case not found." };
  }

  const extractedData = complaint.extracted_data as ExtractedComplaintData | null;

  const steps = await suggestNextSteps({
    description: complaint.description,
    location: complaint.location,
    category: extractedData?.category ?? null,
    extractedData,
  });

  if (!steps) {
    return {
      steps: null,
      error: "Couldn't suggest next steps right now. Please try again.",
    };
  }

  return { steps, error: null };
}
