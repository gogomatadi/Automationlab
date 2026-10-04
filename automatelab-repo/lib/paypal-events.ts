export type SubscriptionState = "pending" | "active" | "past_due" | "suspended" | "cancelled" | "expired";

export type PayPalWebhookEvent = {
  id?: string;
  event_type?: string;
  resource?: {
    id?: string;
    status?: string;
    billing_info?: { next_billing_time?: string };
    amount?: { value?: string; currency_code?: string };
    supplementary_data?: { related_ids?: { order_id?: string } };
  };
};

export function subscriptionStateForEvent(eventType: string, providerStatus?: string): SubscriptionState | null {
  if (eventType === "BILLING.SUBSCRIPTION.ACTIVATED") return "active";
  if (eventType === "BILLING.SUBSCRIPTION.SUSPENDED") return "suspended";
  if (eventType === "BILLING.SUBSCRIPTION.CANCELLED") return "cancelled";
  if (eventType === "BILLING.SUBSCRIPTION.EXPIRED") return "expired";
  if (eventType === "BILLING.SUBSCRIPTION.PAYMENT.FAILED") return "past_due";
  if (eventType === "BILLING.SUBSCRIPTION.CREATED" || eventType === "BILLING.SUBSCRIPTION.UPDATED") {
    const value = providerStatus?.toUpperCase();
    if (value === "ACTIVE") return "active";
    if (value === "SUSPENDED") return "suspended";
    if (value === "CANCELLED") return "cancelled";
    if (value === "EXPIRED") return "expired";
    return "pending";
  }
  return null;
}

export function centsFromPayPal(value?: string) {
  if (!value || !/^\d+(\.\d{1,2})?$/.test(value)) return null;
  return Math.round(Number(value) * 100);
}
