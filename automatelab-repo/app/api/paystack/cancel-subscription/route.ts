import { apiError, isSameOrigin } from "@/lib/http";
import { paystackRequest } from "@/lib/paystack";
import { createAdminClientInstance, requireUser } from "@/lib/supabase/server";

// Self-service cancellation: stops future renewals; access runs to the end of the paid period.
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return apiError("Invalid request origin.", 403);
  const user = await requireUser();
  if (!user?.email) return apiError("Sign in to manage your membership.", 401);

  const supabase = createAdminClientInstance();
  const columns = "paystack_subscription_code,paystack_email_token,paystack_customer_code,current_period_end,email";
  const active = () => supabase.from("subscriptions").select(columns).eq("provider", "paystack").eq("status", "active")
    .order("created_at", { ascending: false }).limit(1);
  const { data: byUser } = await active().eq("user_id", user.id).maybeSingle();
  const subscription = byUser || (await active().eq("email", user.email).maybeSingle()).data;
  if (!subscription?.paystack_subscription_code) return apiError("You don't have an active membership to cancel.", 404);

  let token = subscription.paystack_email_token;
  if (!token) {
    const lookup = await paystackRequest(`/subscription/${encodeURIComponent(subscription.paystack_subscription_code)}`);
    const found = await lookup.json().catch(() => ({})) as { data?: { email_token?: string } };
    token = found.data?.email_token || null;
  }
  if (!token) return apiError("We couldn't cancel automatically. Use Contact us and we'll cancel it for you.", 502);

  const response = await paystackRequest("/subscription/disable", {
    method: "POST",
    body: JSON.stringify({ code: subscription.paystack_subscription_code, token }),
  });
  const result = await response.json().catch(() => ({})) as { status?: boolean; message?: string };
  if (!response.ok || !result.status) return apiError("Paystack could not cancel the membership. Use Contact us and we'll cancel it for you.", 502);

  await supabase.rpc("paystack_sync_library_subscription", {
    p_subscription_code: subscription.paystack_subscription_code,
    p_customer_code: subscription.paystack_customer_code,
    p_email_token: token,
    p_email: subscription.email,
    p_status: "cancelled",
    p_period_end: subscription.current_period_end,
    p_provider_payload: { cancelled_by: "customer", cancelled_at: new Date().toISOString() },
  });
  return Response.json({ ok: true, accessUntil: subscription.current_period_end });
}
