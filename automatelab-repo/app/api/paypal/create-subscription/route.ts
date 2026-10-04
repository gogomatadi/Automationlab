import { publicEnv } from "@/lib/env";
import { apiError, isSameOrigin } from "@/lib/http";
import { paypalRequest } from "@/lib/paypal";
import { createAdminClientInstance, requireUser } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return apiError("Invalid request origin.", 403);
  if (!process.env.SUPABASE_SECRET_KEY || !process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    return apiError("PayPal checkout is being configured. No subscription has been started.", 503);
  }
  const user = await requireUser();
  if (!user?.email) return apiError("Sign in before checkout.", 401);
  const supabase = createAdminClientInstance();
  const { data: planSetting } = await supabase.from("storefront_settings").select("value")
    .eq("key", "paypal_membership_plan_id").maybeSingle();
  if (!planSetting?.value) return apiError("PayPal membership is being configured. No subscription has been started.", 503);
  const { data: current } = await supabase.from("subscriptions")
    .select("id,status,paypal_subscription_id,provider_payload,created_at")
    .eq("user_id", user.id).in("status", ["pending", "active"])
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (current?.status === "active") return apiError("Your membership is already active.", 409);

  if (current?.status === "pending") {
    const statusResponse = await paypalRequest(`/v1/billing/subscriptions/${encodeURIComponent(current.paypal_subscription_id)}`);
    const remote = await statusResponse.json().catch(() => ({})) as {
      status?: string;
      billing_info?: { next_billing_time?: string };
      links?: Array<{ rel: string; href: string }>;
    };
    const remoteStatus = remote.status?.toUpperCase();

    if (statusResponse.ok && remoteStatus === "ACTIVE") {
      await supabase.rpc("sync_library_subscription", {
        p_subscription_id: current.paypal_subscription_id,
        p_status: "active",
        p_period_end: remote.billing_info?.next_billing_time || null,
        p_provider_payload: remote,
      });
      return apiError("Your membership is already active. Open My access.", 409);
    }

    const storedPayload = current.provider_payload as { links?: Array<{ rel: string; href: string }> } | null;
    const approvalUrl = remote.links?.find((link) => link.rel === "approve")?.href
      || storedPayload?.links?.find((link) => link.rel === "approve")?.href;
    if (statusResponse.ok && ["APPROVAL_PENDING", "APPROVED"].includes(remoteStatus || "")) {
      return Response.json({
        approvalUrl: approvalUrl || `${publicEnv.siteUrl()}/paypal/subscription-return`,
        resumed: true,
      });
    }
    if (!statusResponse.ok && statusResponse.status !== 404 && approvalUrl) {
      return Response.json({ approvalUrl, resumed: true });
    }
    if (!statusResponse.ok && statusResponse.status !== 404) {
      return apiError("PayPal is temporarily unavailable. Your pending checkout was preserved; please try again.", 502);
    }

    const terminalStatus = remoteStatus === "EXPIRED" ? "expired"
      : remoteStatus === "SUSPENDED" ? "suspended"
        : "cancelled";
    await supabase.from("subscriptions").update({
      status: terminalStatus,
      provider_payload: statusResponse.ok ? remote : current.provider_payload,
      updated_at: new Date().toISOString(),
    }).eq("id", current.id);
  }

  const response = await paypalRequest("/v1/billing/subscriptions", {
    method: "POST",
    headers: { "PayPal-Request-Id": crypto.randomUUID(), Prefer: "return=representation" },
    body: JSON.stringify({
      plan_id: planSetting.value,
      custom_id: user.id,
      subscriber: { email_address: user.email },
      application_context: {
        brand_name: "AutomateLab",
        user_action: "SUBSCRIBE_NOW",
        return_url: `${publicEnv.siteUrl()}/paypal/subscription-return`,
        cancel_url: `${publicEnv.siteUrl()}/paypal/subscription-cancel`,
      },
    }),
  });
  const subscription = await response.json() as { id?: string; status?: string; links?: Array<{ rel: string; href: string }>; message?: string };
  if (!response.ok || !subscription.id) return apiError(subscription.message || "PayPal could not create the subscription.", 502);
  const { error } = await supabase.from("subscriptions").insert({
    user_id: user.id,
    email: user.email,
    paypal_subscription_id: subscription.id,
    status: "pending",
    provider_payload: subscription,
  });
  if (error) return apiError("The subscription was created but could not be recorded. Please contact support.", 500);
  const approvalUrl = subscription.links?.find((link) => link.rel === "approve")?.href;
  if (!approvalUrl) return apiError("PayPal did not return an approval link.", 502);
  return Response.json({ approvalUrl });
}
