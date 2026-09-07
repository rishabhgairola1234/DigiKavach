import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions/sign-out";
import { LogOut, Radar } from "lucide-react";

export default async function OfficerDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/officer/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "officer") redirect("/officer/login");

  return (
    <div className="flex flex-1 flex-col bg-background bg-grid px-6 py-10">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between">
        <div>
          <p className="text-sm text-muted">Signed in as</p>
          <h1 className="text-xl font-semibold text-foreground">
            {profile?.full_name || user.email}
          </h1>
        </div>
        <form action={signOut}>
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted transition-colors hover:border-accent/50 hover:text-accent-strong">
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </form>
      </header>

      <main className="mx-auto mt-10 flex w-full max-w-5xl flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-border p-16 text-center">
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent-soft text-accent-strong">
          <Radar className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">
          Officer Dashboard
        </h2>
        <p className="mt-2 max-w-sm text-sm text-muted">
          Case list, priority badges, and the Investigation Copilot are
          coming in the next build steps. You&apos;re logged in as an
          officer.
        </p>
      </main>
    </div>
  );
}
