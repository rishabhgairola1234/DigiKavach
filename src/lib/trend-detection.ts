import type { ComplaintCategory } from "@/lib/complaints";

// Deterministic clustering over data already fetched for the dashboard --
// no AI call, no background job. Groups same-category complaints at the same
// (exact-string) location, then checks whether any 3+ of them fall within a
// rolling 48h window using the standard sorted-sliding-window technique.
export const TREND_MIN_COUNT = 3;
export const TREND_WINDOW_HOURS = 48;
export const TREND_LOOKBACK_DAYS = 7;

export type TrendComplaint = {
  id: string;
  title: string;
  category: ComplaintCategory;
  location: string;
  created_at: string;
};

export type TrendAlert = {
  category: ComplaintCategory;
  location: string;
  complaints: { id: string; title: string }[];
};

export function detectTrends(complaints: TrendComplaint[]): TrendAlert[] {
  const groups = new Map<string, TrendComplaint[]>();
  for (const c of complaints) {
    const key = `${c.category}::${c.location.trim().toLowerCase()}`;
    const existing = groups.get(key);
    if (existing) existing.push(c);
    else groups.set(key, [c]);
  }

  const alerts: TrendAlert[] = [];

  for (const group of groups.values()) {
    if (group.length < TREND_MIN_COUNT) continue;

    const sorted = [...group].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    for (let i = 0; i + TREND_MIN_COUNT - 1 < sorted.length; i++) {
      const windowStart = new Date(sorted[i].created_at).getTime();
      const windowEndCandidate = new Date(sorted[i + TREND_MIN_COUNT - 1].created_at).getTime();
      const spanHours = (windowEndCandidate - windowStart) / (1000 * 60 * 60);

      if (spanHours <= TREND_WINDOW_HOURS) {
        const windowEnd = windowStart + TREND_WINDOW_HOURS * 60 * 60 * 1000;
        const cluster = sorted.filter((c) => {
          const t = new Date(c.created_at).getTime();
          return t >= windowStart && t <= windowEnd;
        });

        alerts.push({
          category: sorted[i].category,
          location: sorted[i].location,
          complaints: cluster.map((c) => ({ id: c.id, title: c.title })),
        });
        break; // one alert per group is enough, even if multiple windows qualify
      }
    }
  }

  return alerts;
}
