import { serverEnv } from "@/lib/env";

// Records a marketing-email opt-out. The page sends the per-recipient token from the
// email's unsubscribe link; this route forwards it to the Make webhook, which flips the
// matching lead row to "unsubscribed" in the campaign sheet the sender reads from.
// The shared secret is added here, server-side, so it is never exposed to the browser.
export async function POST(req: Request) {
  let token = "";
  try {
    const body = await req.json();
    token = typeof body?.token === "string" ? body.token.trim() : "";
  } catch {
    return Response.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  // Tokens look like "al-sa-0002-2fsrjh" — short, alphanumeric with hyphens.
  if (!token || token.length > 64 || !/^[A-Za-z0-9-]+$/.test(token)) {
    return Response.json({ ok: false, error: "invalid_token" }, { status: 400 });
  }

  const webhook = serverEnv.makeUnsubscribeWebhook();
  const secret = serverEnv.unsubscribeSecret();
  if (!webhook || !secret) {
    return Response.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  const upstream = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, secret }),
  }).catch(() => null);

  if (!upstream || !upstream.ok) {
    return Response.json({ ok: false, error: "upstream" }, { status: 502 });
  }

  return Response.json({ ok: true });
}
