import { createHmac, timingSafeEqual } from "crypto";
import { serverEnv } from "@/lib/env";

// Paystack REST helper. Mirrors lib/paypal.ts: server-only, Bearer secret key.
export async function paystackRequest(path: string, init: RequestInit = {}) {
  return fetch(`https://api.paystack.co${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${serverEnv.paystackSecret()}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
}

// Paystack signs each webhook body with HMAC-SHA512 using the secret key.
// Must be computed over the RAW request body, not a re-serialised object.
export function verifyPaystackSignature(rawBody: string, signature: string | null) {
  if (!signature) return false;
  const expected = Buffer.from(createHmac("sha512", serverEnv.paystackSecret()).update(rawBody).digest("hex"));
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
