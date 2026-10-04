import { LoginForm } from "@/components/login-form";
import { SiteHeader } from "@/components/site-header";
import { safeReturnTo } from "@/lib/http";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  return <main><SiteHeader/><section className="portal shell narrowPortal">
    <p className="kicker dark">Secure access</p><h1>Sign in to AutomateLab.</h1>
    <p>Use your email and password, Google, or a one-time email link. Use the same email you booked or subscribed with to see everything in one place.</p>
    <LoginForm next={safeReturnTo(params.next || null)} />
  </section></main>;
}
