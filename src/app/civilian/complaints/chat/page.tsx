import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChatComplaintForm } from "./chat-complaint-form";

export default async function ChatComplaintPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/civilian/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "civilian") redirect("/civilian/login");

  return <ChatComplaintForm />;
}
