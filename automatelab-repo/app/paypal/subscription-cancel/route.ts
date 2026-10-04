import { NextResponse } from "next/server";
import { createAdminClientInstance, requireUser } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const user = await requireUser();
  if (user) {
    const supabase = createAdminClientInstance();
    const { data: pending } = await supabase.from("subscriptions").select("id")
      .eq("user_id", user.id).eq("status", "pending")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (pending) {
      await supabase.from("subscriptions").update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      }).eq("id", pending.id);
    }
  }
  return NextResponse.redirect(new URL("/library?checkout=cancelled", request.url));
}
