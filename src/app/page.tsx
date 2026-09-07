import Link from "next/link";
import { ShieldAlert, Siren, ArrowRight, Radar } from "lucide-react";

export default function Home() {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-background bg-grid px-6 py-16">
      {/* ambient glow accents */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[40rem] -translate-x-1/2 rounded-full bg-accent/20 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-accent/10 blur-[100px]" />

      <div className="relative z-10 flex flex-col items-center text-center">
        <div className="mb-5 flex items-center gap-2 rounded-full border border-border bg-background-elevated px-4 py-1.5 text-xs font-medium tracking-wide text-accent-strong">
          <Radar className="h-3.5 w-3.5" />
          DIGIASTRA COMMAND PLATFORM
        </div>
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          Crime Reporting &amp; Investigation,{" "}
          <span className="text-accent-strong">Unified</span>
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
          One platform connecting citizens who need to report incidents with
          officers who investigate them — powered by AI-assisted case
          intelligence.
        </p>
      </div>

      <div className="relative z-10 mt-14 grid w-full max-w-3xl grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Civilian portal */}
        <Link
          href="/civilian/login"
          className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-background-elevated p-7 transition-all hover:-translate-y-1 hover:border-warm-accent/50 hover:shadow-[0_0_40px_-10px_rgba(249,115,22,0.35)]"
        >
          <div>
            <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-warm-accent/15 text-warm-accent">
              <Siren className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">
              Civilian Portal
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              File a complaint, get AI help describing what happened, upload
              evidence, or trigger an SOS in an emergency.
            </p>
          </div>
          <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-warm-accent">
            Civilian Login
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </span>
        </Link>

        {/* Officer portal */}
        <Link
          href="/officer/login"
          className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-background-elevated p-7 transition-all hover:-translate-y-1 hover:border-accent/60 hover:shadow-[0_0_40px_-10px_rgba(14,165,233,0.4)]"
        >
          <div>
            <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent-soft text-accent-strong">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">
              Officer / Authority Portal
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              View active cases, review AI-extracted case data, and query the
              Investigation Copilot for insights.
            </p>
          </div>
          <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-accent-strong">
            Officer Login
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </span>
        </Link>
      </div>

      <p className="relative z-10 mt-12 text-xs text-muted">
        Built for Smart India Hackathon &middot; Internal Round Prototype
      </p>
    </div>
  );
}
