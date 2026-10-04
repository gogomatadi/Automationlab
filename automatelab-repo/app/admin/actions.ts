"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, requireAdmin } from "@/lib/supabase/server";

async function adminClient() {
  const user = await requireAdmin();
  if (!user) redirect("/login?next=/admin");
  return createClient();
}

export async function createCourseSession(formData: FormData) {
  const supabase = await adminClient();
  const title = String(formData.get("title") || "").trim();
  const startsAt = String(formData.get("startsAt") || "");
  const capacity = Number(formData.get("capacity"));
  const status = String(formData.get("status") || "draft");
  if (!title || !startsAt || !Number.isInteger(capacity) || capacity < 1 || capacity > 10 || !["draft", "published"].includes(status)) {
    redirect("/admin/sessions?error=invalid");
  }
  const parsed = new Date(startsAt);
  if (Number.isNaN(parsed.getTime())) redirect("/admin/sessions?error=date");
  const { error } = await supabase.from("course_sessions").insert({
    title,
    starts_at: parsed.toISOString(),
    timezone: "Africa/Johannesburg",
    duration_minutes: 180,
    capacity,
    price_cents: 2900,
    currency: "USD",
    status,
  });
  if (error) redirect("/admin/sessions?error=save");
  revalidatePath("/course");
  revalidatePath("/admin");
  revalidatePath("/admin/sessions");
  redirect("/admin/sessions?saved=1");
}

export async function setCourseSessionStatus(formData: FormData) {
  const supabase = await adminClient();
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "");
  if (!/^[0-9a-f-]{36}$/i.test(id) || !["draft", "published", "closed", "cancelled"].includes(status)) redirect("/admin/sessions?error=invalid");
  const { error } = await supabase.from("course_sessions").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) redirect("/admin/sessions?error=save");
  revalidatePath("/course");
  revalidatePath("/admin");
  revalidatePath("/admin/sessions");
}
