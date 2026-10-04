import type { SubscriptionState } from "@/lib/paypal-events";

export type PaystackEvent = {
  event?: string;
  data?: {
    id?: number;
    reference?: string;
    status?: string;
    amount?: number;
    currency?: string;
    paid_at?: string;
    subscription_code?: string;
    email_token?: string;
    next_payment_date?: string;
    customer?: { email?: string; customer_code?: string };
    plan?: { plan_code?: string } | string;
    metadata?: { user_id?: string; product_type?: string; course_session_id?: string };
    subscription?: { subscription_code?: string; next_payment_date?: string; email_token?: string };
  };
};

// Map a Paystack subscription/invoice event to our subscription_status enum.
export function subscriptionStateForPaystackEvent(event: string, providerStatus?: string): SubscriptionState | null {
  switch (event) {
    case "subscription.create":
    case "subscription.enable":
      return "active";
    case "charge.success":
      return "active";
    case "invoice.create":
    case "invoice.update": {
      const value = providerStatus?.toLowerCase();
      return value === "success" || value === "paid" ? "active" : "past_due";
    }
    case "invoice.payment_failed":
      return "past_due";
    case "subscription.not_renew":
    case "subscription.disable":
      return "cancelled";
    default:
      return null;
  }
}
