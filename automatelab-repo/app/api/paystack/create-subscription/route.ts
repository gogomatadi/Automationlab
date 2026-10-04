import { publicEnv } from "@/lib/env";
import { apiError, isSameOrigin } from "@/lib/http";
import { paystackRequest } from "@/lib/paystack";
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
    .eq("key", "paystack_membership_plan_code").maybeSingle();
  if (!planSetting?.value) return apiError("Membership is being configured. No subscription has been started.", 503);

  // Already an active member? Don't start a second subscription.
  const { data: entitlement } = await supabase.from("entitlements").select("status,expires_at")
    .eq("email", user.email).eq("kind", "library").maybeSingle();
  if (entitlement?.status === "active" && (!entitlement.expires_at || new Date(entitlement.expires_at) > new Date())) {
    return apiError("Your membership is already active. Open My access.", 409);
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
  const result = await response.json().catch(() => ({})) as { status?: boolean; message?: string; data?: { authorization_url?: string } };
  if (!response.ok || !result.status || !result.data?.authorization_url) {
    return apiError(result.message || "Paystack could not start the subscription.", 502);
  }
  return Response.json({ authorizationUrl: result.data.authorization_url });
}
