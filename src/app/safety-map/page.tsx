import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { SafetyMapClient } from "./safety-map-client";
import {
  CATEGORY_LABEL,
  CATEGORY_LABEL_HI,
  CATEGORY_MAP_COLOR,
  type ComplaintCategory,
} from "@/lib/complaints";
import type { SafetyMapPoint } from "./heatmap";
import { Bilingual } from "@/components/bilingual";

// Deliberately public -- no auth check. It reads from public.safety_map_points,
// a view that only ever exposes id/latitude/longitude/category/created_at
// (see supabase/schema.sql, Step 15) and never title, description, or
// civilian_id, so there's nothing identifying to protect behind a login here.
export default async function SafetyMapPage() {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("safety_map_points")
    .select("id, latitude, longitude, category, created_at")
    .order("created_at", { ascending: false });

  const points: SafetyMapPoint[] = (rows ?? [])
    .filter((r) => r.latitude !== null && r.longitude !== null)
    .map((r) => ({
      id: r.id,
      latitude: r.latitude as number,
      longitude: r.longitude as number,
      category: r.category as ComplaintCategory | null,
      createdAt: r.created_at,
    }));

  const categories = Object.keys(CATEGORY_LABEL) as ComplaintCategory[];

  return (
    <div className="flex flex-1 flex-col bg-background bg-grid px-6 py-10">
      <div className="mx-auto w-full max-w-5xl">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted transition-all hover:text-foreground active:scale-[0.98]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <Bilingual en="Back to home" hi="होम पर वापस जाएं" />
        </Link>

        <div className="mb-6 flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warm-accent/15 text-warm-accent">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <Bilingual
              as="h1"
              en="Public Safety Map"
              hi="सार्वजनिक सुरक्षा मानचित्र"
              className="text-xl font-semibold text-foreground"
              hiClassName="ml-1.5 text-sm font-normal text-muted"
            />
            <p className="text-sm text-muted">
              Reported incident locations and types — aggregated and
              anonymous. No names or personal details are ever shown here.
            </p>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-muted">
          {categories.map((category) => (
            <span key={category} className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: CATEGORY_MAP_COLOR[category] }}
              />
              {CATEGORY_LABEL[category]}
              <span className="text-muted/70">{CATEGORY_LABEL_HI[category]}</span>
            </span>
          ))}
        </div>

        <SafetyMapClient points={points} />

        {points.length === 0 && (
          <Bilingual
            as="p"
            en="No mapped incidents yet."
            hi="अभी तक कोई घटना मानचित्रित नहीं।"
            className="mt-4 text-center text-sm text-muted"
            hiClassName="block text-xs text-muted/80"
          />
        )}
      </div>
    </div>
  );
}
