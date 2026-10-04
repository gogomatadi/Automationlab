import { apiError, isSameOrigin } from "@/lib/http";
import { findSubscription, subscriptionToken, syncMembership } from "@/lib/membership";
import { paystackRequest } from "@/lib/paystack";
import { createAdminClientInstance, requireUser } from "@/lib/supabase/server";

// Self-service cancellation: stops future renewals; access runs to the end of the paid period.
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return apiError("Invalid request origin.", 403);
  const user = await requireUser();
  if (!user?.email) return apiError("Sign in to manage your membership.", 401);

  const supabase = createAdminClientInstance();
  const subscription = await findSubscription(supabase, { id: user.id, email: user.email }, "active");
  if (!subscription?.paystack_subscription_code) return apiError("You don't have an active membership to cancel.", 404);

  const token = await subscriptionToken(subscription);
  if (!token) return apiError("We couldn't cancel automatically. Use Contact us and we'll cancel it for you.", 502);

  const response = await paystackRequest("/subscription/disable", {
    method: "POST",
    body: JSON.stringify({ code: subscription.paystack_subscription_code, token }),
  });
  const result = await response.json().catch(() => ({})) as { status?: boolean };
  if (!response.ok || !result.status) return apiError("Paystack could not cancel the membership. Use Contact us and we'll cancel it for you.", 502);

  await syncMembership(supabase, subscription, token, "cancelled", "cancel");
  return Response.json({ ok: true, accessUntil: subscription.current_period_end });
}
