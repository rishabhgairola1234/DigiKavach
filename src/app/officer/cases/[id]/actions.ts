"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { askCaseCopilot } from "@/lib/gemini/case-copilot";
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
