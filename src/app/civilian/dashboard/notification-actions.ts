"use server";

import { createClient } from "@/lib/supabase/server";

export async function markNotificationRead(notificationId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
    .eq("civilian_id", user.id);

  if (error) {
    console.error(`[markNotificationRead] Failed to mark notification ${notificationId} read:`, error);
  }
}
