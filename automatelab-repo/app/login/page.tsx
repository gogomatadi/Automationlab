import { LoginForm } from "@/components/login-form";
import { SiteHeader } from "@/components/site-header";
import { safeReturnTo } from "@/lib/http";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  return <main><SiteHeader/><section className="portal shell narrowPortal">
    <p className="kicker dark">Secure access</p><h1>Sign in without a password.</h1>
    <p>Continue with Google or request a single-use email link. Use the same address connected to your purchase.</p>
    <LoginForm next={safeReturnTo(params.next || null)} />
  </section></main>;
}
