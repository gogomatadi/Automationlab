export function isInitialMembershipActivation(provider: "paypal" | "paystack", eventType: string) {
  return provider === "paypal"
    ? eventType === "BILLING.SUBSCRIPTION.ACTIVATED"
    : eventType === "subscription.create";
}
