import { accountTopics, contactTopics, escapeHtml, isContactTopic, isEmail } from "@/lib/contact";
import { serverEnv } from "@/lib/env";
import { apiError, isSameOrigin } from "@/lib/http";
import { createClient, requireUser } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return apiError("Invalid request origin.", 403);
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return apiError("Invalid request."); }

  // Honeypot: bots fill every field; pretend success and drop it.
  if (typeof body.website === "string" && body.website) return Response.json({ ok: true });

  const topic = body.topic;
  if (!isContactTopic(topic)) return apiError("Choose what your message is about.");
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (message.length < 2 || message.length > 2000) return apiError("Write a message between 2 and 2,000 characters.");
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 100) : "";

  const user = await requireUser();
  const needsAccount = accountTopics.includes(topic);
  if (needsAccount && !user?.email) return apiError("Sign in to request a cancellation or refund.", 401);

  const email = user?.email || (typeof body.email === "string" ? body.email.trim() : "");
  if (!isEmail(email)) return apiError("Enter a valid email address.");

  let accountSummary = "Not signed in";
  if (user) {
    const supabase = await createClient();
    const [{ data: entitlements }, { data: registrations }] = await Promise.all([
      supabase.from("entitlements").select("kind,status,expires_at").eq("user_id", user.id),
      supabase.from("registrations").select("id,status,course_sessions(title,starts_at)").eq("user_id", user.id),
    ]);
    accountSummary = JSON.stringify({ userId: user.id, entitlements: entitlements || [], registrations: registrations || [] });
  }

  const webhook = serverEnv.makeContactWebhook();
  if (!webhook) return apiError("The contact form is not available right now. Email business@massuba.com instead.", 503);

  const requestId = crypto.randomUUID();
  const response = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requestId,
      topic,
      topicLabel: contactTopics[topic],
      name: name || "there",
      email,
      verifiedAccount: user ? "yes" : "no",
      messageHtml: escapeHtml(message).replace(/\n/g, "<br>"),
      accountSummary: escapeHtml(accountSummary),
      submittedAt: new Date().toISOString(),
    }),
  }).catch(() => null);
  if (!response?.ok) return apiError("Your message could not be sent. Email business@massuba.com instead.", 502);

  return Response.json({ ok: true, requestId });
}
