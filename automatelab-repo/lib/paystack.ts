import { createHmac, timingSafeEqual } from "crypto";
import { serverEnv } from "@/lib/env";

// Paystack REST helper. Mirrors lib/paypal.ts: server-only, Bearer secret key.
export async function paystackRequest(path: string, init: RequestInit = {}) {
  try {
    return await fetch(`https://api.paystack.co${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${serverEnv.paystackSecret()}`,
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
      cache: "no-store",
    });
  } catch (reason) {
    // Never let a network or configuration failure crash the route with an empty 500.
    const detail = reason instanceof Error ? `${reason.name}: ${reason.message}`.slice(0, 200) : "unknown";
    console.error("Paystack request failed", path, detail);
    // detail is the error type only (e.g. invalid header character); it never contains the key.
    return Response.json({ status: false, message: "Payments are temporarily unavailable. No payment has been taken; please try again shortly.", detail }, { status: 502 });
  }
}

// Paystack signs each webhook body with HMAC-SHA512 using the secret key.
// Must be computed over the RAW request body, not a re-serialised object.
export function verifyPaystackSignature(rawBody: string, signature: string | null) {
  if (!signature) return false;
  const expected = Buffer.from(createHmac("sha512", serverEnv.paystackSecret()).update(rawBody).digest("hex"));
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

// Paystack test and live plans have different codes; pick the one matching the active secret key
// so swapping PAYSTACK_SECRET_KEY to sk_live_ can't send a live checkout to a test plan.
export function membershipPlanSettingKey() {
  return serverEnv.paystackSecret().startsWith("sk_live_") ? "paystack_membership_plan_code_live" : "paystack_membership_plan_code";
}
