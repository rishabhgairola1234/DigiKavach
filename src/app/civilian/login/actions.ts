"use server";

import { loginAndVerifyRole } from "@/lib/supabase/auth-actions";
import type { AuthActionState } from "@/lib/supabase/auth-state";

export async function loginCivilian(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  return loginAndVerifyRole(formData, "civilian");
}
