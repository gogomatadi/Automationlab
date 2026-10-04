import type { SupabaseClient } from "@supabase/supabase-js";
import { paystackRequest } from "@/lib/paystack";

export type MembershipRow = {
  paystack_subscription_code: string | null;
  paystack_email_token: string | null;
  paystack_customer_code: string | null;
  current_period_end: string | null;
  email: string;
};

// Latest Paystack subscription in the given state for this account (matched by user id, then email).
export async function findSubscription(supabase: SupabaseClient, user: { id: string; email: string }, status: "active" | "cancelled") {
  const columns = "paystack_subscription_code,paystack_email_token,paystack_customer_code,current_period_end,email";
  const query = () => supabase.from("subscriptions").select(columns).eq("provider", "paystack").eq("status", status)
    .order("created_at", { ascending: false }).limit(1);
  const { data: byUser } = await query().eq("user_id", user.id).maybeSingle<MembershipRow>();
  return byUser || (await query().eq("email", user.email).maybeSingle<MembershipRow>()).data;
}

// Paystack's enable/disable endpoints need the subscription's email token; fetch it if we never stored it.
export async function subscriptionToken(subscription: MembershipRow) {
  if (subscription.paystack_email_token) return subscription.paystack_email_token;
  if (!subscription.paystack_subscription_code) return null;
  const lookup = await paystackRequest(`/subscription/${encodeURIComponent(subscription.paystack_subscription_code)}`);
  const found = await lookup.json().catch(() => ({})) as { data?: { email_token?: string } };
  return found.data?.email_token || null;
}

export async function syncMembership(supabase: SupabaseClient, subscription: MembershipRow, token: string, status: "active" | "cancelled", note: string) {
  await supabase.rpc("paystack_sync_library_subscription", {
    p_subscription_code: subscription.paystack_subscription_code,
    p_customer_code: subscription.paystack_customer_code,
    p_email_token: token,
    p_email: subscription.email,
    p_status: status,
    p_period_end: subscription.current_period_end,
    p_provider_payload: { changed_by: "customer", change: note, changed_at: new Date().toISOString() },
  });
}
