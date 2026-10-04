import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { ReleaseUploader } from "@/components/release-uploader";
import { createClient, requireAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ReleasesAdminPage() {
  if (!await requireAdmin()) redirect("/login?next=/admin/releases");
  const supabase = await createClient();
  const { data: releases } = await supabase.from("releases").select("id,version,title,blueprint_count,file_name,file_size_bytes,is_current,published_at").order("version", { ascending: false });
  return <main><SiteHeader/><section className="portal shell">
    <div className="portalTitle"><div><p className="kicker dark">Admin · library</p><h1>Manage releases</h1></div><Link href="/admin">← Control centre</Link></div>
    <div className="adminGrid"><article className="dashboardCard"><span>PRIVATE STORAGE</span><h2>Publish a ZIP</h2><p>The browser uploads directly to the private storage bucket. Customers receive a 60-second signed URL only while their subscription is active.</p><ReleaseUploader/></article>
      <article className="dashboardCard"><span>RELEASE HISTORY</span><h2>{releases?.length || 0} releases</h2><div className="adminList">{releases?.map((release)=><div key={release.id}><p><b>v{release.version} · {release.title}</b><br/>{release.blueprint_count} files · {(release.file_size_bytes/1024/1024).toFixed(2)} MB<br/>{release.is_current ? "Current" : "Archived"} · {release.file_name}</p></div>)}</div></article></div>
  </section></main>;
}
