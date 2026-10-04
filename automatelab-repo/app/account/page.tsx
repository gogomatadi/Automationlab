import { redirect } from "next/navigation";
import { CancelMembershipButton, PasswordForm } from "@/components/account-actions";
import { BookingCard } from "@/components/booking-card";
import { SiteHeader } from "@/components/site-header";
import { formatDay } from "@/lib/booking";
import { toBookingView, type BookingView } from "@/lib/booking-view";
import { createClient, requireUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Session = { title: string; starts_at: string; duration_minutes: number; timezone: string };
const one = <T,>(value: T | T[] | null | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ purchase?: string; password?: string }> }) {
  const user = await requireUser();
  if (!user) redirect("/login?next=/account");
  const [supabase, params] = await Promise.all([createClient(), searchParams]);
  const [{ data: entitlements }, { data: registrations }, { data: bookings }, { data: subscriptions }, { data: release }] = await Promise.all([
    supabase.from("entitlements").select("kind,status,expires_at").eq("user_id", user.id),
    supabase.from("registrations").select("payment_id,status,course_sessions(title,starts_at,duration_minutes,timezone)").eq("user_id", user.id),
    supabase.from("course_bookings").select("reference,full_name,email,phone,company,payment_id").eq("user_id", user.id),
    supabase.from("subscriptions").select("status,current_period_end").eq("user_id", user.id).eq("provider", "paystack").order("created_at", { ascending: false }).limit(1),
    supabase.from("releases").select("version,blueprint_count").eq("is_current", true).maybeSingle(),
  ]);

  const library = entitlements?.find((item) => item.kind === "library");
  const libraryActive = !!library && library.status === "active" && (!library.expires_at || new Date(library.expires_at) > new Date());
  const subscription = subscriptions?.[0];
  const periodEnd = subscription?.current_period_end ? formatDay(subscription.current_period_end) : null;

  const bookingViews: BookingView[] = (registrations || [])
    .map((registration) => ({ registration, session: one(registration.course_sessions) as Session | null }))
    .filter((item): item is { registration: typeof item.registration; session: Session } => !!item.session)
    .sort((a, b) => a.session.starts_at.localeCompare(b.session.starts_at))
    .map(({ registration, session }) => {
      const booking = bookings?.find((item) => item.payment_id === registration.payment_id);
      return toBookingView(booking || { reference: "—" }, session, registration.status, true);
    });

  return <main><SiteHeader/><section className="portal shell">
    <div className="portalTitle"><div><p className="kicker dark">Customer portal</p><h1>My access</h1><p>{user.email}</p></div>
      <div className="portalActions"><a className="button darkButton" href="/contact">Contact us</a><a href="/logout">Sign out</a></div></div>
    {params.password === "reset" && <p className="formMessage" role="status">You&apos;re signed in. Choose a new password under Sign-in below.</p>}
    {params.purchase === "library" && !libraryActive && <p className="formMessage" role="status">Payment received. Your membership activates as soon as Paystack confirms it, usually within a minute. Refresh this page shortly.</p>}

    <div className="dashboardGrid">
      <article className="dashboardCard"><span>BLUEPRINT MEMBERSHIP</span>
        <h2>{libraryActive ? (subscription?.status === "cancelled" ? "Cancelled · access continues" : "Active") : "No active membership"}</h2>
        {libraryActive && <dl className="detailList">
          <div><dt>Plan</dt><dd>R179 / month</dd></div>
          {periodEnd && <div><dt>{subscription?.status === "cancelled" ? "Access until" : "Renews on"}</dt><dd>{periodEnd}</dd></div>}
          {release && <div><dt>Library</dt><dd>{release.blueprint_count} blueprints · release v{release.version}</dd></div>}
        </dl>}
        {libraryActive && release ? <a className="button primary" href="/api/download">Download current ZIP →</a> : !libraryActive && <a className="button darkButton" href="/library">View membership →</a>}
        {libraryActive && subscription?.status === "active" && <CancelMembershipButton renewsOn={periodEnd} />}
      </article>

      <article className="dashboardCard"><span>COURSE BOOKINGS</span>
        <h2>{bookingViews.length ? `${bookingViews.length} booking${bookingViews.length > 1 ? "s" : ""}` : "No bookings yet"}</h2>
        {bookingViews.length ? bookingViews.map((booking, index) => <BookingCard key={`${booking.reference}-${index}`} booking={booking} showActions />) : <><p>Your paid course sessions will appear here.</p><a className="button darkButton" href="/course">See course dates →</a></>}
        <a className="textLink" href="/booking">Look up a booking by reference</a>
      </article>

      <article className="dashboardCard"><span>SIGN-IN</span>
        <h2>Password</h2>
        <p>Set a password to sign in with your email and password next time. Google and email-link sign-in keep working.</p>
        <PasswordForm />
      </article>
    </div>
  </section></main>;
}
