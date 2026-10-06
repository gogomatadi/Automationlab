import { publicEnv } from "@/lib/env";
import { apiError, isSameOrigin } from "@/lib/http";
import { membershipPlanSettingKey, paystackRequest } from "@/lib/paystack";
import { createAdminClientInstance, requireUser } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return apiError("Invalid request origin.", 403);
  if (!process.env.SUPABASE_SECRET_KEY || !process.env.PAYSTACK_SECRET_KEY) {
    return apiError("Membership checkout is being configured. No subscription has been started.", 503);
  }
  const user = await requireUser();
  if (!user?.email) return apiError("Sign in before checkout.", 401);
  const supabase = createAdminClientInstance();

  const { data: planSetting } = await supabase.from("storefront_settings").select("value")
    .eq("key", membershipPlanSettingKey()).maybeSingle();
  if (!planSetting?.value) return apiError("Membership is being configured. No subscription has been started.", 503);

  // Already an active member? Don't start a second subscription.
  const { data: entitlement } = await supabase.from("entitlements").select("status,expires_at")
    .eq("email", user.email).eq("kind", "library").maybeSingle();
  if (entitlement?.status === "active" && (!entitlement.expires_at || new Date(entitlement.expires_at) > new Date())) {
    const { data: latest } = await supabase.from("subscriptions").select("status").eq("email", user.email)
      .eq("provider", "paystack").order("created_at", { ascending: false }).limit(1).maybeSingle();
    return apiError(latest?.status === "cancelled"
      ? "Your membership is cancelled but still active. Resume it from My access to keep it going."
      : "Your membership is already active. Open My access.", 409);
  }

  const reference = `al_m_${crypto.randomUUID().replace(/-/g, "")}`;
  const response = await paystackRequest("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: user.email,
      plan: planSetting.value,
      reference,
      callback_url: `${publicEnv.siteUrl()}/account?purchase=library`,
      metadata: { user_id: user.id, product_type: "library_subscription" },
    }),
  });
  const result = await response.json().catch(() => ({})) as { status?: boolean; message?: string; detail?: string; data?: { authorization_url?: string } };
  if (!response.ok || !result.status || !result.data?.authorization_url) {
    return Response.json({ error: result.message || "Paystack could not start the subscription.", detail: result.detail }, { status: 502 });
  }
  return Response.json({ authorizationUrl: result.data.authorization_url });
}
