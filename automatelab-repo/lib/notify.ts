import type { SupabaseClient } from "@supabase/supabase-js";
import { escapeHtml } from "@/lib/contact";
import { publicEnv, serverEnv } from "@/lib/env";
import { formatMoney, formatSessionDate, formatSessionTime } from "@/lib/booking";

type SessionRow = { title: string; starts_at: string; duration_minutes: number; timezone: string };

// Sends the booking confirmation at most once. Both the return page and the webhook call this;
// the conditional update claims the send so only one of them posts to Make.
export async function sendBookingConfirmation(supabase: SupabaseClient, paymentId: string) {
  const webhook = serverEnv.makeBookingWebhook();
  if (!webhook) return;
  const { data: booking } = await supabase.from("course_bookings")
    .update({ confirmation_sent_at: new Date().toISOString() })
    .eq("payment_id", paymentId).is("confirmation_sent_at", null)
    .select("reference,full_name,email,phone,company,goal,course_session_id")
    .maybeSingle();
  if (!booking) return;

  const [{ data: session }, { data: payment }] = await Promise.all([
    supabase.from("course_sessions").select("title,starts_at,duration_minutes,timezone").eq("id", booking.course_session_id).maybeSingle<SessionRow>(),
    supabase.from("payments").select("amount_cents,currency").eq("id", paymentId).maybeSingle(),
  ]);
  if (!session) return;

  const response = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "course_booking_confirmed",
      reference: booking.reference,
      fullName: escapeHtml(booking.full_name),
      email: booking.email,
      phone: escapeHtml(booking.phone),
      company: escapeHtml(booking.company || "—"),
      goal: escapeHtml(booking.goal || "—"),
      sessionTitle: escapeHtml(session.title),
      sessionDate: formatSessionDate(session.starts_at, session.timezone),
      sessionTime: formatSessionTime(session.starts_at, session.duration_minutes, session.timezone),
      amountPaid: payment ? formatMoney(payment.amount_cents, payment.currency) : "",
      lookupUrl: `${publicEnv.siteUrl()}/booking?ref=${encodeURIComponent(booking.reference)}`,
      accountUrl: `${publicEnv.siteUrl()}/account`,
    }),
  }).catch(() => null);

  // Release the claim so the next caller (webhook retry or page reload) can try again.
  if (!response?.ok) await supabase.from("course_bookings").update({ confirmation_sent_at: null }).eq("payment_id", paymentId);
}
