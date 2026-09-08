import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ArrowLeft, Search } from "lucide-react";
import { SearchForm } from "./search-form";
import { Bilingual } from "@/components/bilingual";

export default async function CaseSearchPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/officer/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "officer") redirect("/officer/login");

  return (
    <div className="flex flex-1 flex-col bg-background bg-grid px-6 py-10">
      <div className="mx-auto w-full max-w-3xl">
        <Link
          href="/officer/dashboard"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted transition-all hover:text-foreground active:scale-[0.98]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <Bilingual en="Back to dashboard" hi="डैशबोर्ड पर वापस जाएं" />
        </Link>

        <div className="mb-6 flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-strong">
            <Search className="h-5 w-5" />
          </div>
          <div>
            <Bilingual
              as="h1"
              en="Cross-Case Search"
              hi="क्रॉस-केस खोज"
              className="text-xl font-semibold text-foreground"
              hiClassName="ml-1.5 text-sm font-normal text-muted"
            />
            <p className="text-sm text-muted">
              Describe what you&apos;re looking for in plain language — Gemini scans every
              case&apos;s title and extracted details for genuine matches.
            </p>
          </div>
        </div>

        <SearchForm />
      </div>
    </div>
  );
}
