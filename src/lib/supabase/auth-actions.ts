"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { AuthActionState, Role } from "@/lib/supabase/auth-state";

/**
 * Signs in and confirms the account's role matches the portal being used —
 * an officer credential entered on the civilian login (or vice versa) is rejected.
 */
export async function loginAndVerifyRole(
  formData: FormData,
  role: Role
): Promise<AuthActionState> {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  if (profileError) {
    // Fetch failed (RLS/grant issue, network blip, etc) -- distinct from an
    // actual role mismatch, so it must not be reported as one.
    console.error(
      `[loginAndVerifyRole] Failed to load profile for user ${data.user.id}:`,
      profileError
    );
    await supabase.auth.signOut();
    return { error: "We couldn't verify your account. Please try again." };
  }

  const actualRole = profile.role?.trim().toLowerCase();

  if (actualRole !== role) {
    await supabase.auth.signOut();
    return {
      error:
        role === "officer"
          ? "This account is not an officer account."
          : "This account is not a civilian account. Please use the officer login.",
    };
  }

  redirect(`/${role}/dashboard`);
}
