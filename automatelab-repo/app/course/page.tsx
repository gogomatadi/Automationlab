import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { BookingForm } from "@/components/booking-form";
import { formatMoney, formatSessionDate, formatSessionTime } from "@/lib/booking";
import { createClient, requireUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const checkoutMessages: Record<string, string> = {
  failed: "Payment was not completed. No booking was made; you can try again.",
  unknown: "We couldn't find that checkout. If you were charged, contact us with your Paystack receipt.",
  "recording-failed": "Your payment went through but we couldn't record the booking yet. It will be confirmed automatically; contact us if it doesn't appear in My access within an hour.",
};

export default async function CoursePage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const user = await requireUser();
  if (!user) redirect("/login?next=/course");
  const [supabase, params] = await Promise.all([createClient(), searchParams]);
  const { data: sessions } = await supabase.from("course_sessions").select("id,title,starts_at,timezone,duration_minutes,capacity,price_cents,currency").eq("status","published").gt("starts_at", new Date().toISOString()).order("starts_at");
  const message = params.checkout ? checkoutMessages[params.checkout] : null;
  return <main><SiteHeader/><section className="portal shell">
    <p className="kicker dark">Live, once-off course</p><h1>Choose your build session.</h1>
    <p className="portalLead">A practical, small-group live course. Pick a date, add your details, and pay securely by card. Your booking reference appears straight after payment.</p>
    {message && <p className="formError" role="alert">{message}</p>}
    <div className="sessionGrid">{sessions?.length ? sessions.map((session)=><article className="sessionCard" key={session.id}>
      <span className="tag">LIVE · SMALL GROUP · {session.capacity} SEATS</span><h2>{session.title}</h2>
      <dl className="detailList">
        <div><dt>Date</dt><dd>{formatSessionDate(session.starts_at, session.timezone)}</dd></div>
        <div><dt>Time</dt><dd>{formatSessionTime(session.starts_at, session.duration_minutes, session.timezone)}</dd></div>
        <div><dt>Duration</dt><dd>{session.duration_minutes / 60} hours, live</dd></div>
      </dl>
      <strong className="sessionPrice">{formatMoney(session.price_cents, session.currency)}</strong>
      <BookingForm courseSessionId={session.id} accountEmail={user.email || ""} priceLabel={formatMoney(session.price_cents, session.currency)} />
    </article>) : <div className="emptyState"><h2>New dates are being prepared.</h2><p>Check back soon. Only upcoming dates published by the course team appear here.</p></div>}</div>
  </section></main>;
}
