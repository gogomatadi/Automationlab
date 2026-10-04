"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sastInputToIso } from "@/lib/booking";
import { createClient, requireAdmin } from "@/lib/supabase/server";

async function adminClient() {
  const user = await requireAdmin();
  if (!user) redirect("/login?next=/admin");
  return createClient();
}

type SessionFields = { title: string; starts_at: string; duration_minutes: number; capacity: number; price_cents: number };

// Admin enters times in South African time and prices in rand; stored as UTC and ZAR cents.
function parseSessionFields(formData: FormData): SessionFields | null {
  const title = String(formData.get("title") || "").trim();
  const startsAt = sastInputToIso(String(formData.get("startsAt") || ""));
  const capacity = Number(formData.get("capacity"));
  const durationHours = Number(formData.get("durationHours"));
  const priceRand = Number(String(formData.get("priceRand") || "").replace(/[\s,]/g, ""));
  if (!title || title.length > 120 || !startsAt) return null;
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 10) return null;
  if (!Number.isFinite(durationHours) || durationHours < 0.5 || durationHours > 12) return null;
  if (!Number.isFinite(priceRand) || priceRand < 1 || priceRand > 100000) return null;
  return { title, starts_at: startsAt, duration_minutes: Math.round(durationHours * 60), capacity, price_cents: Math.round(priceRand * 100) };
}

function refreshSessionPages() {
  revalidatePath("/course");
  revalidatePath("/admin");
  revalidatePath("/admin/sessions");
}

export async function createCourseSession(formData: FormData) {
  const supabase = await adminClient();
  const fields = parseSessionFields(formData);
  const status = String(formData.get("status") || "draft");
  if (!fields || !["draft", "published"].includes(status)) redirect("/admin/sessions?error=invalid");
  const { error } = await supabase.from("course_sessions").insert({
    ...fields,
    timezone: "Africa/Johannesburg",
    currency: "ZAR",
    status,
  });
  if (error) redirect("/admin/sessions?error=save");
  refreshSessionPages();
  redirect("/admin/sessions?saved=1");
}

export async function updateCourseSession(formData: FormData) {
  const supabase = await adminClient();
  const id = String(formData.get("id") || "");
  const fields = parseSessionFields(formData);
  if (!/^[0-9a-f-]{36}$/i.test(id) || !fields) redirect("/admin/sessions?error=invalid");
  const { count } = await supabase.from("registrations").select("id", { count: "exact", head: true })
    .eq("course_session_id", id).eq("status", "confirmed");
  if ((count || 0) > fields.capacity) redirect("/admin/sessions?error=capacity");
  const { error } = await supabase.from("course_sessions").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) redirect("/admin/sessions?error=save");
  refreshSessionPages();
  redirect("/admin/sessions?saved=1");
}

export async function setCourseSessionStatus(formData: FormData) {
  const supabase = await adminClient();
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "");
  if (!/^[0-9a-f-]{36}$/i.test(id) || !["draft", "published", "closed", "cancelled"].includes(status)) redirect("/admin/sessions?error=invalid");
  const { error } = await supabase.from("course_sessions").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) redirect("/admin/sessions?error=save");
  refreshSessionPages();
}
