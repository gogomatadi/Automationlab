import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { createClient, requireAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireAdmin();
  if (!user) redirect("/login?next=/admin");
  const supabase = await createClient();
  const [{ data: sessions }, { count: registrations }, { count: subscribers }, { data: release }, { data: failedEvents }] = await Promise.all([
    supabase.from("course_sessions").select("id,title,starts_at,status,capacity,price_cents").order("starts_at"),
    supabase.from("registrations").select("id",{count:"exact",head:true}),
    supabase.from("subscriptions").select("id",{count:"exact",head:true}).eq("status","active"),
    supabase.from("releases").select("version,title,blueprint_count,file_name,file_size_bytes,published_at").eq("is_current",true).maybeSingle(),
    supabase.from("paypal_webhook_events").select("event_id,event_type,error_message,received_at").eq("status","failed").order("received_at",{ascending:false}).limit(5),
  ]);
  return <main><SiteHeader/><section className="portal shell"><div className="portalTitle"><div><p className="kicker dark">Restricted administration</p><h1>Storefront control centre</h1><p>Signed in as {user.email}</p></div><a href="/logout">Sign out</a></div>
    <div className="metricGrid"><article><span>Registrations</span><b>{registrations || 0}</b></article><article><span>Active subscribers</span><b>{subscribers || 0}</b></article><article><span>Current release</span><b>{release ? `v${release.version}` : "—"}</b></article><article><span>Webhook failures</span><b>{failedEvents?.length || 0}</b></article></div>
    <div className="adminGrid"><article className="dashboardCard"><span>COURSE DATES</span><h2>Published and draft sessions</h2>{sessions?.length ? sessions.map((session)=><p key={session.id}><b>{session.status}</b> · {session.title} · {new Date(session.starts_at).toLocaleString("en-ZA")}</p>) : <p>No course sessions created.</p>}<a className="button darkButton" href="/admin/sessions">Manage dates →</a></article>
      <article className="dashboardCard"><span>BLUEPRINT RELEASE</span><h2>{release?.title || "No release published"}</h2><p>{release ? `${release.blueprint_count} files · ${release.file_name}` : "Upload the validated ZIP and publish it from the release manager."}</p><a className="button darkButton" href="/admin/releases">Manage releases →</a></article>
      <article className="dashboardCard"><span>PAYMENTS</span><h2>PayPal Sandbox</h2><p>Verify the secured Vercel credentials before accepting test payments.</p><a className="button darkButton" href="/admin/paypal">Check PayPal →</a></article></div>
  </section></main>;
}
