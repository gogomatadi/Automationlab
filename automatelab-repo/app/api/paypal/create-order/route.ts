import { apiError, isSameOrigin } from "@/lib/http";
import { paypalRequest } from "@/lib/paypal";
import { createAdminClientInstance, requireUser } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return apiError("Invalid request origin.", 403);
  if (!process.env.SUPABASE_SECRET_KEY || !process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    return apiError("PayPal checkout is being configured. No payment has been started.", 503);
  }
  const user = await requireUser();
  if (!user?.email) return apiError("Sign in before checkout.", 401);
  const body = await request.json().catch(() => ({})) as { courseSessionId?: string };
  if (!body.courseSessionId || !/^[0-9a-f-]{36}$/i.test(body.courseSessionId)) return apiError("Choose a valid course session.");

  const supabase = createAdminClientInstance();
  const { data: session } = await supabase.from("course_sessions")
    .select("id,title,capacity,price_cents,currency,status,registration_deadline")
    .eq("id", body.courseSessionId).eq("status", "published").maybeSingle();
  if (!session || (session.registration_deadline && new Date(session.registration_deadline) <= new Date())) return apiError("That course session is not available.", 404);

  const { count } = await supabase.from("registrations").select("id", { count: "exact", head: true })
    .eq("course_session_id", session.id).eq("status", "confirmed");
  if ((count || 0) >= session.capacity) return apiError("That course session is full.", 409);

  const response = await paypalRequest("/v2/checkout/orders", {
    method: "POST",
    headers: { "PayPal-Request-Id": crypto.randomUUID() },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{
        reference_id: session.id,
        custom_id: user.id,
        description: session.title,
        amount: { currency_code: session.currency, value: (session.price_cents / 100).toFixed(2) },
      }],
      payment_source: { paypal: { experience_context: {
        brand_name: "AutomateLab",
        user_action: "PAY_NOW",
        return_url: `${publicEnv.siteUrl()}/paypal/course-return`,
        cancel_url: `${publicEnv.siteUrl()}/course?checkout=cancelled`,
      } } },
    }),
  });
  const order = await response.json() as { id?: string; links?: Array<{ rel: string; href: string }>; message?: string };
  if (!response.ok || !order.id) return apiError(order.message || "PayPal could not create the order.", 502);

  const { error } = await supabase.rpc("reserve_course_order", {
    p_user_id: user.id,
    p_email: user.email,
    p_course_session_id: session.id,
    p_order_id: order.id,
    p_amount_cents: session.price_cents,
    p_currency: session.currency,
    p_provider_payload: order,
  });
  if (error) return apiError("The order was created but could not be recorded. Please contact support.", 500);
  const approvalUrl = order.links?.find((link) => link.rel === "payer-action" || link.rel === "approve")?.href;
  if (!approvalUrl) return apiError("PayPal did not return an approval link.", 502);
  return Response.json({ approvalUrl });
}
