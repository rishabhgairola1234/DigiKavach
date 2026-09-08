"use client";

// IMPORTANT: leaflet touches `window` at import time, so this module can
// never be evaluated during SSR -- same rule as officer/dashboard/mini-map.tsx.
// Always import this component via next/dynamic with { ssr: false } from
// wherever it's used, never as a plain top-level import.
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { CATEGORY_MAP_COLOR, type ComplaintCategory } from "@/lib/complaints";

export type SafetyMapPoint = {
  id: string;
  latitude: number;
  longitude: number;
  category: ComplaintCategory | null;
  createdAt: string;
};

// Bangalore, Karnataka -- used only when there are no points yet, at a
// city-scale zoom, so the map looks intentional from the first load instead
// of a generic world view or an empty ocean coordinate.
const DEFAULT_CENTER: [number, number] = [12.9716, 77.5946];
const DEFAULT_ZOOM = 12;

// How far in the flyTo animates when a list item is clicked -- close enough
// to feel like "zooming into this specific incident".
const FOCUS_ZOOM = 16;
const FLY_TO_DURATION_SECONDS = 1;

export function SafetyHeatmap({
  points,
  focusPointId,
}: {
  points: SafetyMapPoint[];
  focusPointId: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.CircleMarker>>(new Map());

  // Map + marker creation only ever depends on the point data, never on
  // which item is focused -- keeping these as separate effects means
  // clicking a list item can't accidentally tear down and rebuild the whole
  // map (which would also cancel any in-progress flyTo).
  useEffect(() => {
    if (!containerRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
    });
    mapRef.current = map;
    markersRef.current = new Map();

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    if (points.length === 0) {
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    } else {
      for (const point of points) {
        const color = CATEGORY_MAP_COLOR[point.category ?? "other"];
        const marker = L.circleMarker([point.latitude, point.longitude], {
          radius: 7,
          color,
          weight: 1,
          fillColor: color,
          fillOpacity: 0.55,
        })
          .bindPopup(
            point.category
              ? `Reported incident: ${point.category.replace("_", " ")}`
              : "Reported incident"
          )
          .addTo(map);
        markersRef.current.set(point.id, marker);
      }

      const bounds = L.latLngBounds(points.map((p) => [p.latitude, p.longitude]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = new Map();
    };
  }, [points]);

  // Smoothly pans/zooms to a marker and opens its popup when the sidebar
  // list selects it, without touching the map/marker setup above.
  useEffect(() => {
    if (!focusPointId) return;
    const map = mapRef.current;
    const marker = markersRef.current.get(focusPointId);
    if (!map || !marker) return;

    map.flyTo(marker.getLatLng(), FOCUS_ZOOM, { duration: FLY_TO_DURATION_SECONDS });
    marker.openPopup();
  }, [focusPointId]);

  return <div ref={containerRef} className="h-[520px] w-full rounded-xl" />;
}
