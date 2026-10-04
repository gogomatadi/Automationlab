import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env";
import { createClient, requireUser } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.redirect(new URL("/login?next=/account", request.url));
  const supabase = await createClient();
  const { data: entitlement } = await supabase.from("entitlements").select("id,expires_at")
    .eq("user_id", user.id).eq("kind", "library").eq("status", "active").maybeSingle();
  if (!entitlement || (entitlement.expires_at && new Date(entitlement.expires_at) <= new Date())) {
    return NextResponse.json({ error: "An active blueprint membership is required." }, { status: 403 });
  }
  const { data: release } = await supabase.from("releases").select("storage_path").eq("is_current", true).not("published_at", "is", null).maybeSingle();
  if (!release) return NextResponse.json({ error: "No release is currently available." }, { status: 404 });
  const { data, error } = await supabase.storage.from(serverEnv.releaseBucket()).createSignedUrl(release.storage_path, 60, { download: true });
  if (error || !data?.signedUrl) return NextResponse.json({ error: "The secure download link could not be created." }, { status: 500 });
  return NextResponse.redirect(data.signedUrl, 303);
}
