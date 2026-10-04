import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { formatMoney, formatSessionDate, formatSessionTime, isoToSastInput } from "@/lib/booking";
import { createClient, requireAdmin } from "@/lib/supabase/server";
import { createCourseSession, setCourseSessionStatus, updateCourseSession } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

const errors: Record<string, string> = {
  invalid: "Check the fields: title, a date and time, 1–10 seats, 0.5–12 hours and a price in rand.",
  capacity: "Seats can't be lower than the number of people already booked.",
  save: "The session could not be saved. Try again.",
};

export default async function SessionsAdminPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  if (!await requireAdmin()) redirect("/login?next=/admin/sessions");
  const [supabase, params] = await Promise.all([createClient(), searchParams]);
  const [{ data: sessions }, { data: registrations }] = await Promise.all([
    supabase.from("course_sessions").select("id,title,starts_at,timezone,duration_minutes,status,capacity,price_cents,currency").order("starts_at", { ascending: false }),
    supabase.from("registrations").select("course_session_id").eq("status", "confirmed"),
  ]);
  const booked = (id: string) => registrations?.filter((item) => item.course_session_id === id).length || 0;

  return <main><SiteHeader/><section className="portal shell">
    <div className="portalTitle"><div><p className="kicker dark">Admin · course</p><h1>Manage live dates</h1></div><Link href="/admin">← Control centre</Link></div>
    {params.error && <p className="formError" role="alert">{errors[params.error] || errors.save}</p>}
    {params.saved && <p className="formMessage" role="status">Saved. The course page now shows the updated details.</p>}
    <div className="adminGrid"><article className="dashboardCard"><span>NEW SESSION</span><h2>Create a date</h2>
      <form className="adminForm" action={createCourseSession}>
        <label>Title<input name="title" required maxLength={120} defaultValue="Automate Your Business" /></label>
        <label>Start date and time (South African time)<input name="startsAt" type="datetime-local" required /></label>
        <label>Duration (hours)<input name="durationHours" type="number" min="0.5" max="12" step="0.5" required defaultValue="3" /></label>
        <label>Price (R)<input name="priceRand" type="number" min="1" step="0.01" required defaultValue="1450" /></label>
        <label>Capacity (maximum 10)<input name="capacity" type="number" min="1" max="10" required defaultValue="10" /></label>
        <label>Status<select name="status" defaultValue="draft"><option value="draft">Draft</option><option value="published">Published</option></select></label>
        <button className="button primary" type="submit">Save session</button>
      </form></article>
      <article className="dashboardCard"><span>EXISTING SESSIONS</span><h2>{sessions?.length || 0} dates</h2>
        <div className="adminList">{sessions?.map((session)=><div key={session.id} className="adminSession">
          <p><b>{session.title}</b><br/>{formatSessionDate(session.starts_at, session.timezone)} · {formatSessionTime(session.starts_at, session.duration_minutes, session.timezone)}<br/>{formatMoney(session.price_cents, session.currency)} · {booked(session.id)}/{session.capacity} booked · {session.status}</p>
          <form action={setCourseSessionStatus}><input type="hidden" name="id" value={session.id}/><select name="status" defaultValue={session.status}><option value="draft">Draft</option><option value="published">Published</option><option value="closed">Closed</option><option value="cancelled">Cancelled</option></select><button type="submit">Update</button></form>
          <details><summary>Edit date, price or seats</summary>
            <form className="adminForm" action={updateCourseSession}>
              <input type="hidden" name="id" value={session.id}/>
              <label>Title<input name="title" required maxLength={120} defaultValue={session.title} /></label>
              <label>Start date and time (South African time)<input name="startsAt" type="datetime-local" required defaultValue={isoToSastInput(session.starts_at)} /></label>
              <label>Duration (hours)<input name="durationHours" type="number" min="0.5" max="12" step="0.5" required defaultValue={session.duration_minutes / 60} /></label>
              <label>Price (R)<input name="priceRand" type="number" min="1" step="0.01" required defaultValue={session.price_cents / 100} /></label>
              <label>Capacity (maximum 10)<input name="capacity" type="number" min="1" max="10" required defaultValue={session.capacity} /></label>
              <button className="button primary" type="submit">Save changes</button>
            </form>
          </details>
        </div>)}</div>
      </article></div>
  </section></main>;
}
