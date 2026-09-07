"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ShieldAlert, ArrowLeft, Loader2 } from "lucide-react";
import { Field } from "@/components/auth/field";
import { initialAuthActionState } from "@/lib/supabase/auth-state";
import { loginOfficer } from "./actions";

export default function OfficerLoginPage() {
  const [state, formAction, pending] = useActionState(
    loginOfficer,
    initialAuthActionState
  );

  return (
    <div className="flex flex-1 items-center justify-center bg-background bg-grid px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-border bg-background-elevated p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent-soft text-accent-strong">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground">
            Officer Login
          </h1>
          <p className="mt-1 text-sm text-muted">
            Access case data and the Investigation Copilot
          </p>
        </div>

        <form action={formAction} className="flex flex-col gap-4">
          <Field label="Email" name="email" type="email" autoComplete="email" />
          <Field
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
          />

          {state.error && (
            <p className="rounded-lg border border-priority-high/30 bg-priority-high/10 px-3 py-2 text-sm text-priority-high">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-strong disabled:opacity-60"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Log in
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted">
          Officer accounts are provisioned by administrators. Contact your
          admin if you need access.
        </p>
        <Link
          href="/"
          className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to home
        </Link>
      </div>
    </div>
  );
}
