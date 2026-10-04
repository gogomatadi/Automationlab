import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { CheckoutButton } from "@/components/checkout-button";
import { createClient, requireUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function CoursePage() {
  const user = await requireUser();
  if (!user) redirect("/login?next=/course");
  const supabase = await createClient();
  const { data: sessions } = await supabase.from("course_sessions").select("id,title,starts_at,timezone,duration_minutes,capacity,price_cents,currency").eq("status","published").order("starts_at");
  return <main><SiteHeader/><section className="portal shell">
    <p className="kicker dark">Live, once-off course</p><h1>Choose your build session.</h1>
    <p className="portalLead">A three-hour practical course. Select a published date, pay securely by card, and your registration will appear in My access after payment is verified.</p>
    <div className="sessionGrid">{sessions?.length ? sessions.map((session)=><article className="sessionCard" key={session.id}>
      <span className="tag">LIVE · SMALL GROUP</span><h2>{session.title}</h2>
      <p><b>{new Intl.DateTimeFormat("en-ZA",{dateStyle:"full",timeStyle:"short",timeZone:session.timezone}).format(new Date(session.starts_at))}</b></p>
      <p>{session.duration_minutes / 60} hours · Africa/Johannesburg</p><strong className="sessionPrice">{new Intl.NumberFormat("en-ZA",{style:"currency",currency:session.currency}).format(session.price_cents/100)}</strong>
      <CheckoutButton kind="course" courseSessionId={session.id} label="Register & pay →" />
    </article>) : <div className="emptyState"><h2>New dates are being prepared.</h2><p>Sign in again soon. Only dates published by the course admin appear here.</p></div>}</div>
  </section></main>;
}
