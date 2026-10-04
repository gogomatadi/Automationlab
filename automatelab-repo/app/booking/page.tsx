import type { Metadata } from "next";
import { BookingCard } from "@/components/booking-card";
import { BookingLookup } from "@/components/booking-lookup";
import { SiteHeader } from "@/components/site-header";
import { normaliseReference } from "@/lib/booking";
import { toBookingView } from "@/lib/booking-view";
import { createClient, requireUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Your booking | AutomateLab" };
export const dynamic = "force-dynamic";

export default async function BookingPage({ searchParams }: { searchParams: Promise<{ ref?: string; new?: string }> }) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  const reference = normaliseReference(params.ref);

  // Signed-in owners see their full booking straight away (RLS limits rows to their own).
  if (user && reference) {
    const supabase = await createClient();
    const { data: booking } = await supabase.from("course_bookings")
      .select("reference,full_name,email,phone,company,payment_id,course_sessions(title,starts_at,duration_minutes,timezone)")
      .eq("reference", reference).maybeSingle();
    const session = Array.isArray(booking?.course_sessions) ? booking.course_sessions[0] : booking?.course_sessions;
    if (booking && session) {
      const { data: registration } = await supabase.from("registrations").select("status").eq("payment_id", booking.payment_id).maybeSingle();
      const view = toBookingView(booking, session, registration?.status || null, true);
      return <main><SiteHeader/><section className="portal shell narrowPortal">
        <p className="kicker dark">{params.new ? "Booking confirmed" : "Your booking"}</p>
        <h1>{params.new ? "You're booked in." : "Booking details"}</h1>
        {params.new && <p>Thanks{view.fullName ? `, ${view.fullName.split(" ")[0]}` : ""}. Keep your booking reference <b>{view.reference}</b>. You can look it up here any time, and it&apos;s listed in <a href="/account">My access</a>. Paystack has emailed your payment receipt.</p>}
        <BookingCard booking={view} showActions />
        <p><a className="button darkButton" href="/account">Go to My access →</a></p>
      </section></main>;
    }
  }

  return <main><SiteHeader/><section className="portal shell narrowPortal">
    <p className="kicker dark">Find a booking</p><h1>Look up your booking.</h1>
    <p>Enter the reference from your confirmation (it starts with AL-) and the email you booked with.</p>
    <BookingLookup initialReference={reference || ""} />
  </section></main>;
}
