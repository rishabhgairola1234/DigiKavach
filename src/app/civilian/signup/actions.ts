"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { AuthActionState } from "@/lib/supabase/auth-state";

export async function signUpCivilian(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const fullName = String(formData.get("fullName") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!fullName || !email || !password) {
    return { error: "All fields are required." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const supabase = await createClient();

  // Only full_name is passed as metadata — role is never accepted from the client.
  // A database trigger (see supabase/schema.sql) always creates new signups as 'civilian'.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  if (error) {
    return { error: error.message };
  }

  if (!data.session) {
    return {
      error: null,
      message: "Account created. Check your email to confirm it, then log in.",
    };
  }

  redirect("/civilian/dashboard");
}
