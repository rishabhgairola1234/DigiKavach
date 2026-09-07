"use server";

import { createClient } from "@/lib/supabase/server";

export type SendSosResult = { error: string | null };

export async function sendSosAlert(
  latitude: number,
  longitude: number
): Promise<SendSosResult> {
  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    Number.isNaN(latitude) ||
    Number.isNaN(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return { error: "Invalid location data." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in to send an SOS alert." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "civilian") {
    return { error: "Only civilian accounts can send SOS alerts." };
  }

  const { error } = await supabase.from("sos_alerts").insert({
    civilian_id: user.id,
    latitude,
    longitude,
  });

  if (error) {
    console.error("[sendSosAlert] Failed to insert SOS alert:", error);
    return {
      error: "Failed to send alert. Please try again or call emergency services directly.",
    };
  }

  return { error: null };
}
