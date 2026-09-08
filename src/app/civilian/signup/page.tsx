"use client";

import { useActionState } from "react";
import Link from "next/link";
import { UserPlus, ArrowLeft, Loader2 } from "lucide-react";
import { Field } from "@/components/auth/field";
import { initialAuthActionState } from "@/lib/supabase/auth-state";
import { signUpCivilian } from "./actions";
import { Bilingual } from "@/components/bilingual";

export default function CivilianSignupPage() {
  const [state, formAction, pending] = useActionState(
    signUpCivilian,
    initialAuthActionState
  );

  return (
    <div className="flex flex-1 items-center justify-center bg-background bg-grid px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-border bg-background-elevated p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-warm-accent/15 text-warm-accent">
            <UserPlus className="h-6 w-6" />
          </div>
          <Bilingual
            as="h1"
            en="Create Civilian Account"
            hi="नागरिक खाता बनाएं"
            className="text-2xl font-semibold text-foreground"
            hiClassName="block text-sm font-normal text-muted"
          />
          <p className="mt-1 text-sm text-muted">
            File complaints and track your cases
          </p>
        </div>

        <form action={formAction} className="flex flex-col gap-4">
          <Field
            label="Full name"
            labelHi="पूरा नाम"
            name="fullName"
            type="text"
            autoComplete="name"
            focusClassName="focus:border-warm-accent"
          />
          <Field
            label="Email"
            labelHi="ईमेल"
            name="email"
            type="email"
            autoComplete="email"
            focusClassName="focus:border-warm-accent"
          />
          <Field
            label="Password"
            labelHi="पासवर्ड"
            name="password"
            type="password"
            autoComplete="new-password"
            focusClassName="focus:border-warm-accent"
          />

          {state.error && (
            <p className="pop-in rounded-lg border border-priority-high/30 bg-priority-high/10 px-3 py-2 text-sm text-priority-high">
              {state.error}
            </p>
          )}
          {state.message && (
            <p className="pop-in rounded-lg border border-priority-low/30 bg-priority-low/10 px-3 py-2 text-sm text-priority-low">
              {state.message}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-warm-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-warm-accent/90 disabled:opacity-60"
          >
            {pending && <Loader2 className="fade-in h-4 w-4 animate-spin" />}
            <Bilingual en="Create account" hi="खाता बनाएं" />
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link
            href="/civilian/login"
            className="font-medium text-warm-accent transition-colors hover:text-warm-accent/80"
          >
            <Bilingual en="Log in" hi="लॉग इन करें" />
          </Link>
        </p>
        <Link
          href="/"
          className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <Bilingual en="Back to home" hi="होम पर वापस जाएं" />
        </Link>
      </div>
    </div>
  );
}
