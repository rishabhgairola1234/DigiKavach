export type GeocodedLocation = { latitude: number; longitude: number };

/**
 * Best-effort geocoding of free-text location via Nominatim (OpenStreetMap's
 * free geocoding service -- no API key). Called once at complaint filing
 * time, server-side (a custom User-Agent, required by Nominatim's usage
 * policy, can only be set from a server request, not a browser fetch).
 * Returns null on any failure -- a complaint with no coordinates just won't
 * appear on the public safety map; filing itself is never blocked by this.
 */
export async function geocodeLocation(location: string): Promise<GeocodedLocation | null> {
  const trimmed = location.trim();
  if (!trimmed) return null;

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(trimmed)}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "DigiKavach/1.0 (Crime Reporting & Investigation Platform)",
      },
    });

    if (!response.ok) {
      console.error(`[geocodeLocation] Nominatim returned ${response.status} for "${trimmed}"`);
      return null;
    }

    const results = (await response.json()) as { lat: string; lon: string }[];
    if (!Array.isArray(results) || results.length === 0) return null;

    const latitude = Number.parseFloat(results[0].lat);
    const longitude = Number.parseFloat(results[0].lon);
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) return null;

    return { latitude, longitude };
  } catch (err) {
    console.error(`[geocodeLocation] Failed to geocode "${trimmed}":`, err);
    return null;
  }
}
