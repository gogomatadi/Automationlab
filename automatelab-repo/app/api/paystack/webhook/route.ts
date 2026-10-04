import { sendBookingConfirmation } from "@/lib/notify";
import { verifyPaystackSignature } from "@/lib/paystack";
import { PaystackEvent, subscriptionStateForPaystackEvent } from "@/lib/paystack-events";
import { createAdminClientInstance } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifyPaystackSignature(raw, request.headers.get("x-paystack-signature"))) {
    return Response.json({ error: "Invalid signature." }, { status: 401 });
  }
  let event: PaystackEvent;
  try { event = JSON.parse(raw) as PaystackEvent; } catch { return Response.json({ error: "Invalid event." }, { status: 400 }); }
  if (!event?.event || !event.data) return Response.json({ error: "Invalid event." }, { status: 400 });

  const d = event.data;
  const eventId = `${event.event}:${d.reference || d.subscription_code || d.id || ""}`;

  const supabase = createAdminClientInstance();
  const { error: insertError } = await supabase.from("paystack_webhook_events").insert({
    event_id: eventId, event_type: event.event, payload: event,
  });
  if (insertError?.code === "23505") return Response.json({ received: true, duplicate: true });
  if (insertError) return Response.json({ error: "Event could not be recorded." }, { status: 500 });

  try {
    const isSubscriptionCharge = event.event === "charge.success" && !!d.plan;

    if (event.event === "charge.success" && !isSubscriptionCharge) {
      // One-off course payment.
      const reference = d.reference;
      if (!reference) throw new Error("Charge event is missing a reference.");
      const { data: payment } = await supabase.from("payments")
        .select("id,amount_cents,currency,product_type,status")
        .eq("paystack_reference", reference).maybeSingle();
      if (!payment) throw new Error("Charge event has no matching payment.");
      if (payment.product_type === "course" && payment.status !== "paid") {
        if (d.status !== "success") throw new Error("Charge was not successful.");
        if (d.amount !== payment.amount_cents || d.currency !== payment.currency) {
          throw new Error("Charge amount or currency does not match the order.");
        }
        const { error } = await supabase.rpc("paystack_confirm_course_payment", {
          p_reference: reference, p_provider_payload: d,
        });
        if (error) throw error;
      }
      if (payment.product_type === "course") await sendBookingConfirmation(supabase, payment.id);
    } else {
      // Subscription lifecycle: create / renewal invoice / disable / not_renew.
      const state = subscriptionStateForPaystackEvent(event.event, d.status);
      const subscriptionCode = d.subscription_code || d.subscription?.subscription_code;
      const email = d.customer?.email;
      if (state && subscriptionCode && email) {
        const { error } = await supabase.rpc("paystack_sync_library_subscription", {
          p_subscription_code: subscriptionCode,
          p_customer_code: d.customer?.customer_code || null,
          p_email_token: d.email_token || d.subscription?.email_token || null,
          p_email: email,
          p_status: state,
          p_period_end: d.next_payment_date || d.subscription?.next_payment_date || null,
          p_provider_payload: d,
        });
        if (error) throw error;
      }
    }
    await supabase.from("paystack_webhook_events").update({ status: "processed", processed_at: new Date().toISOString() }).eq("event_id", eventId);
    return Response.json({ received: true });
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "Unknown webhook processing error";
    await supabase.from("paystack_webhook_events").update({ status: "failed", error_message: message.slice(0, 1000), processed_at: new Date().toISOString() }).eq("event_id", eventId);
    return Response.json({ error: "Event processing failed." }, { status: 500 });
  }
}
