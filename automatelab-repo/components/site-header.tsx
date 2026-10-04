import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";

export async function SiteHeader() {
  const user = await requireUser();
  const isAdmin = user?.email?.toLowerCase() === serverEnv.adminEmail();

  return <nav className="nav shell" aria-label="Main navigation">
    <Link className="brand" href="/"><span className="brandMark">A</span><span>Automate<span className="lime">Lab</span></span></Link>
    <div className="navLinks"><Link href="/course">Course</Link><Link href="/library">Blueprint library</Link><Link href="/account">My access</Link></div>
    <Link className="navCta" href={isAdmin ? "/admin" : user ? "/account" : "/login"}>
      {isAdmin ? "Admin" : user ? "My access" : "Sign in"} <span>↗</span>
    </Link>
  </nav>;
}
