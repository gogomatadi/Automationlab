import { apiError, isSameOrigin } from "@/lib/http";
import { publicEnv } from "@/lib/env";
import { paystackRequest } from "@/lib/paystack";
import { createAdminClientInstance, requireUser } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return apiError("Invalid request origin.", 403);
  if (!process.env.SUPABASE_SECRET_KEY || !process.env.PAYSTACK_SECRET_KEY) {
    return apiError("Card checkout is being configured. No payment has been started.", 503);
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

  const reference = `al_c_${crypto.randomUUID().replace(/-/g, "")}`;
  const response = await paystackRequest("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: user.email,
      amount: session.price_cents,
      currency: session.currency,
      reference,
      callback_url: `${publicEnv.siteUrl()}/paystack/course-return`,
      metadata: {
        user_id: user.id,
        product_type: "course",
        course_session_id: session.id,
      },
    }),
  });
  const result = await response.json().catch(() => ({})) as { status?: boolean; message?: string; data?: { authorization_url?: string; reference?: string } };
  if (!response.ok || !result.status || !result.data?.authorization_url) {
    return apiError(result.message || "Paystack could not start the checkout.", 502);
  }

  const { error } = await supabase.rpc("paystack_reserve_course_order", {
    p_user_id: user.id,
    p_email: user.email,
    p_course_session_id: session.id,
    p_reference: reference,
    p_amount_cents: session.price_cents,
    p_currency: session.currency,
    p_provider_payload: result.data,
  });
  if (error) return apiError("The checkout was created but could not be recorded. Please contact support.", 500);
  return Response.json({ authorizationUrl: result.data.authorization_url });
}
