import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { createClient, requireUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser();
  if (!user) redirect("/login?next=/account");
  const supabase = await createClient();
  const [{ data: entitlements }, { data: registrations }, { data: release }] = await Promise.all([
    supabase.from("entitlements").select("id,kind,status,expires_at").eq("user_id",user.id),
    supabase.from("registrations").select("id,status,course_sessions(title,starts_at,timezone)").eq("user_id",user.id),
    supabase.from("releases").select("id,title,version,blueprint_count,file_name,published_at").eq("is_current",true).maybeSingle(),
  ]);
  const libraryAccess = entitlements?.some((item)=>item.kind === "library" && item.status === "active" && (!item.expires_at || new Date(item.expires_at) > new Date()));
  return <main><SiteHeader/><section className="portal shell"><div className="portalTitle"><div><p className="kicker dark">Customer portal</p><h1>My access</h1><p>{user.email}</p></div><div className="portalActions"><a className="button darkButton" href="/contact?topic=cancel_membership">Contact us / cancel</a><a href="/logout">Sign out</a></div></div>
    <div className="dashboardGrid"><article className="dashboardCard"><span>BLUEPRINT LIBRARY</span><h2>{libraryAccess ? "Access active" : "No active access"}</h2><p>{release ? `${release.blueprint_count} blueprints · Release v${release.version}` : "No release has been published yet."}</p>{libraryAccess && release ? <a className="button primary" href="/api/download">Download current ZIP →</a> : <a className="button darkButton" href="/library">View membership →</a>}</article>
      <article className="dashboardCard"><span>COURSE REGISTRATIONS</span><h2>{registrations?.length || 0} confirmed</h2>{registrations?.length ? registrations.map((registration)=><p key={registration.id}>{registration.status} · {JSON.stringify(registration.course_sessions)}</p>) : <p>Your paid course sessions will appear here.</p>}</article></div>
  </section></main>;
}
