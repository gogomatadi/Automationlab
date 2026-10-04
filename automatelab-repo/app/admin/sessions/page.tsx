import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { createClient, requireAdmin } from "@/lib/supabase/server";
import { createCourseSession, setCourseSessionStatus } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default async function SessionsAdminPage() {
  if (!await requireAdmin()) redirect("/login?next=/admin/sessions");
  const supabase = await createClient();
  const { data: sessions } = await supabase.from("course_sessions").select("id,title,starts_at,status,capacity,price_cents").order("starts_at", { ascending: false });
  return <main><SiteHeader/><section className="portal shell">
    <div className="portalTitle"><div><p className="kicker dark">Admin · course</p><h1>Manage live dates</h1></div><Link href="/admin">← Control centre</Link></div>
    <div className="adminGrid"><article className="dashboardCard"><span>NEW SESSION</span><h2>Create a date</h2>
      <form className="adminForm" action={createCourseSession}>
        <label>Title<input name="title" required defaultValue="Build Your First AI Workflow" /></label>
        <label>Start date and time<input name="startsAt" type="datetime-local" required /></label>
        <label>Capacity (maximum 10)<input name="capacity" type="number" min="1" max="10" required defaultValue="10" /></label>
        <label>Status<select name="status" defaultValue="draft"><option value="draft">Draft</option><option value="published">Published</option></select></label>
        <button className="button primary" type="submit">Save session</button>
      </form></article>
      <article className="dashboardCard"><span>EXISTING SESSIONS</span><h2>{sessions?.length || 0} dates</h2>
        <div className="adminList">{sessions?.map((session)=><div key={session.id}><p><b>{session.title}</b><br/>{new Date(session.starts_at).toLocaleString("en-ZA")} · {session.capacity} seats · ${(session.price_cents/100).toFixed(2)}</p>
          <form action={setCourseSessionStatus}><input type="hidden" name="id" value={session.id}/><select name="status" defaultValue={session.status}><option value="draft">Draft</option><option value="published">Published</option><option value="closed">Closed</option><option value="cancelled">Cancelled</option></select><button type="submit">Update</button></form></div>)}</div>
      </article></div>
  </section></main>;
}
