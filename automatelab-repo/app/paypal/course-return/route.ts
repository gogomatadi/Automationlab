import { NextResponse } from "next/server";
import { paypalRequest } from "@/lib/paypal";
import { centsFromPayPal } from "@/lib/paypal-events";
import { createAdminClientInstance, requireUser } from "@/lib/supabase/server";

type CaptureOrder = { id?: string; status?: string; purchase_units?: Array<{ payments?: { captures?: Array<{ id?: string; status?: string; amount?: { value?: string; currency_code?: string } }> } }> };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const orderId = url.searchParams.get("token");
  const user = await requireUser();
  if (!user || !orderId) return NextResponse.redirect(new URL("/login?next=/account", url.origin));
  const supabase = createAdminClientInstance();
  const { data: payment } = await supabase.from("payments").select("id,user_id,status,amount_cents,currency")
    .eq("paypal_order_id", orderId).eq("user_id", user.id).maybeSingle();
  if (!payment) return NextResponse.redirect(new URL("/course?checkout=unknown", url.origin));
  if (payment.status === "paid") return NextResponse.redirect(new URL("/account?purchase=course", url.origin));

  let response = await paypalRequest(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: "POST",
    headers: { "PayPal-Request-Id": `capture-${orderId}` },
    body: "{}",
  });
  if (!response.ok && response.status === 422) response = await paypalRequest(`/v2/checkout/orders/${encodeURIComponent(orderId)}`);
  const order = await response.json() as CaptureOrder;
  const capture = order.purchase_units?.[0]?.payments?.captures?.[0];
  const amountMatches = centsFromPayPal(capture?.amount?.value) === payment.amount_cents && capture?.amount?.currency_code === payment.currency;
  if (!response.ok || order.status !== "COMPLETED" || capture?.status !== "COMPLETED" || !capture.id || !amountMatches) {
    return NextResponse.redirect(new URL("/course?checkout=failed", url.origin));
  }
  const { error } = await supabase.rpc("confirm_course_payment", {
    p_order_id: orderId,
    p_capture_id: capture.id,
    p_provider_payload: order,
  });
  if (error) return NextResponse.redirect(new URL("/course?checkout=recording-failed", url.origin));
  return NextResponse.redirect(new URL("/account?purchase=course", url.origin));
}
