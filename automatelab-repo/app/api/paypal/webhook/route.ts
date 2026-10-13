import { sendMembershipActivation } from "@/lib/notify";
import { isInitialMembershipActivation } from "@/lib/membership-events";
import { verifyPayPalWebhook } from "@/lib/paypal";
import { centsFromPayPal, PayPalWebhookEvent, subscriptionStateForEvent } from "@/lib/paypal-events";
import { createAdminClientInstance } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const event = await request.json().catch(() => null) as PayPalWebhookEvent | null;
  if (!event?.id || !event.event_type) return Response.json({ error: "Invalid event." }, { status: 400 });
  if (!await verifyPayPalWebhook(request, event)) return Response.json({ error: "Invalid signature." }, { status: 401 });

  const supabase = createAdminClientInstance();
  const { error: insertError } = await supabase.from("paypal_webhook_events").insert({
    event_id: event.id,
    event_type: event.event_type,
    payload: event,
  });
  if (insertError?.code === "23505") {
    const { data: retryClaim, error: retryError } = await supabase.from("paypal_webhook_events")
      .update({ status: "received", error_message: null, processed_at: null })
      .eq("event_id", event.id).eq("status", "failed").select("event_id").maybeSingle();
    if (retryError) return Response.json({ error: "Event retry could not be recorded." }, { status: 500 });
    if (!retryClaim) return Response.json({ received: true, duplicate: true });
  } else if (insertError) {
    return Response.json({ error: "Event could not be recorded." }, { status: 500 });
  }

  try {
    if (isInitialMembershipActivation("paypal", event.event_type) && !event.resource?.id) {
      throw new Error("PayPal activation event is missing its subscription ID.");
    }
    const subscriptionState = subscriptionStateForEvent(event.event_type, event.resource?.status);
    if (subscriptionState && event.resource?.id) {
      const { error } = await supabase.rpc("sync_library_subscription", {
        p_subscription_id: event.resource.id,
        p_status: subscriptionState,
        p_period_end: event.resource.billing_info?.next_billing_time || null,
        p_provider_payload: event.resource,
      });
      if (error) throw error;
      if (isInitialMembershipActivation("paypal", event.event_type)) {
        const { data: member, error: memberError } = await supabase.from("subscriptions")
          .select("email").eq("paypal_subscription_id", event.resource.id).maybeSingle<{ email: string }>();
        if (memberError) throw memberError;
        if (!member?.email) throw new Error("Active PayPal subscription has no matching member email.");
        await sendMembershipActivation(member.email, "paypal", event.resource.id);
      }
    } else if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
      const orderId = event.resource?.supplementary_data?.related_ids?.order_id;
      if (!orderId || !event.resource?.id) throw new Error("Capture event is missing related IDs.");
      const { data: payment } = await supabase.from("payments").select("amount_cents,currency,product_type,status")
        .eq("paypal_order_id", orderId).maybeSingle();
      if (!payment) throw new Error("Capture event has no matching payment.");
      if (payment.product_type === "course" && payment.status !== "paid") {
        if (centsFromPayPal(event.resource.amount?.value) !== payment.amount_cents || event.resource.amount?.currency_code !== payment.currency) {
          throw new Error("Capture amount or currency does not match the order.");
        }
        const { error } = await supabase.rpc("confirm_course_payment", {
          p_order_id: orderId,
          p_capture_id: event.resource.id,
          p_provider_payload: event.resource,
        });
        if (error) throw error;
      }
    }
    await supabase.from("paypal_webhook_events").update({ status: "processed", processed_at: new Date().toISOString() }).eq("event_id", event.id);
    return Response.json({ received: true });
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "Unknown webhook processing error";
    await supabase.from("paypal_webhook_events").update({ status: "failed", error_message: message.slice(0, 1000), processed_at: new Date().toISOString() }).eq("event_id", event.id);
    return Response.json({ error: "Event processing failed." }, { status: 500 });
  }
}
