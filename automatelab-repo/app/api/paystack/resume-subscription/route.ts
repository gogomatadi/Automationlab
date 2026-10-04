import { apiError, isSameOrigin } from "@/lib/http";
import { findSubscription, subscriptionToken, syncMembership } from "@/lib/membership";
import { paystackRequest } from "@/lib/paystack";
import { createAdminClientInstance, requireUser } from "@/lib/supabase/server";

// Undo a cancellation while the paid period is still running: renewals restart on the same card,
// with no new charge today. Once the period has ended, the customer subscribes again from /library.
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return apiError("Invalid request origin.", 403);
  const user = await requireUser();
  if (!user?.email) return apiError("Sign in to manage your membership.", 401);

  const supabase = createAdminClientInstance();
  const subscription = await findSubscription(supabase, { id: user.id, email: user.email }, "cancelled");
  if (!subscription?.paystack_subscription_code) return apiError("There's no cancelled membership to resume.", 404);
  if (!subscription.current_period_end || new Date(subscription.current_period_end) <= new Date()) {
    return apiError("Your paid period has ended. Subscribe again from the membership page.", 409);
  }

  const token = await subscriptionToken(subscription);
  if (!token) return apiError("We couldn't resume automatically. Subscribe again from the membership page.", 502);

  const response = await paystackRequest("/subscription/enable", {
    method: "POST",
    body: JSON.stringify({ code: subscription.paystack_subscription_code, token }),
  });
  const result = await response.json().catch(() => ({})) as { status?: boolean };
  if (!response.ok || !result.status) return apiError("Paystack could not resume the membership. Subscribe again from the membership page.", 502);

  await syncMembership(supabase, subscription, token, "active", "resume");
  return Response.json({ ok: true, renewsOn: subscription.current_period_end });
}
