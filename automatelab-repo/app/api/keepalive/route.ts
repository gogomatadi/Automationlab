import { createAdminClientInstance } from "@/lib/supabase/server";

// Supabase Free pauses after ~7 idle days; only a real write counts as activity.
// Called by a Make.com schedule and a Vercel cron. Writes at most once an hour.
const KEY = "keepalive_last_ping";
const MIN_INTERVAL_MS = 60 * 60 * 1000;

async function ping() {
  const supabase = createAdminClientInstance();
  const { data, error: readError } = await supabase.from("storefront_settings").select("value").eq("key", KEY).maybeSingle();
  if (readError) return Response.json({ ok: false, error: "Database read failed." }, { status: 503 });

  const last = data?.value ? Date.parse(data.value) : 0;
  if (Date.now() - last < MIN_INTERVAL_MS) {
    return Response.json({ ok: true, written: false, lastPing: data?.value }, { headers: { "Cache-Control": "no-store" } });
  }

  const now = new Date().toISOString();
  const { error } = await supabase.from("storefront_settings").upsert({ key: KEY, value: now, updated_at: now });
  if (error) return Response.json({ ok: false, error: "Database write failed." }, { status: 503 });
  return Response.json({ ok: true, written: true, lastPing: now }, { headers: { "Cache-Control": "no-store" } });
}

export const dynamic = "force-dynamic";
export const GET = ping;
export const POST = ping;
