import { serverEnv } from "@/lib/env";
import { apiError, isSameOrigin } from "@/lib/http";
import { createClient, requireAdmin } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return apiError("Invalid request origin.", 403);
  if (!await requireAdmin()) return apiError("Administrator access required.", 403);
  const body = await request.json().catch(() => ({})) as { version?: number; fileName?: string; fileSize?: number };
  if (!Number.isInteger(body.version) || Number(body.version) < 1 || !body.fileName?.toLowerCase().endsWith(".zip") || !Number.isInteger(body.fileSize) || Number(body.fileSize) < 1 || Number(body.fileSize) > 250 * 1024 * 1024) {
    return apiError("Provide a valid version and ZIP up to 250 MB.");
  }
  const safeName = body.fileName.replace(/[^a-zA-Z0-9._-]+/g, "-");
  const path = `v${body.version}/${crypto.randomUUID()}-${safeName}`;
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(serverEnv.releaseBucket()).createSignedUploadUrl(path);
  if (error || !data?.signedUrl) return apiError("Private storage is not ready for uploads.", 500);
  return Response.json({ signedUrl: data.signedUrl, path });
}
