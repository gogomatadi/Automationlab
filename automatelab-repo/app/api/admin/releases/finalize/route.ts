import { serverEnv } from "@/lib/env";
import { apiError, isSameOrigin } from "@/lib/http";
import { createClient, requireAdmin } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return apiError("Invalid request origin.", 403);
  if (!await requireAdmin()) return apiError("Administrator access required.", 403);
  const body = await request.json().catch(() => ({})) as { version?: number; title?: string; blueprintCount?: number; fileName?: string; fileSize?: number; path?: string };
  if (!Number.isInteger(body.version) || Number(body.version) < 1 || !body.title?.trim() || !Number.isInteger(body.blueprintCount) || Number(body.blueprintCount) < 1 || !body.fileName?.toLowerCase().endsWith(".zip") || !Number.isInteger(body.fileSize) || Number(body.fileSize) < 1 || !body.path?.startsWith(`v${body.version}/`)) {
    return apiError("Release details are invalid.");
  }
  const supabase = await createClient();
  const slash = body.path.lastIndexOf("/");
  const folder = body.path.slice(0, slash);
  const objectName = body.path.slice(slash + 1);
  const { data: objects, error: listError } = await supabase.storage.from(serverEnv.releaseBucket()).list(folder, { search: objectName, limit: 10 });
  const object = objects?.find((item) => item.name === objectName);
  if (listError || !object) return apiError("Uploaded ZIP could not be verified.", 400);
  const actualSize = Number(object.metadata?.size || 0);
  if (actualSize !== body.fileSize) return apiError("Uploaded ZIP size does not match.", 400);
  const { error } = await supabase.rpc("publish_release", {
    p_version: body.version,
    p_title: body.title.trim(),
    p_blueprint_count: body.blueprintCount,
    p_storage_path: body.path,
    p_file_name: body.fileName,
    p_file_size_bytes: actualSize,
  });
  if (error) return apiError(error.code === "23505" ? "That release version already exists." : "Release could not be recorded.", 500);
  return Response.json({ published: true });
}
