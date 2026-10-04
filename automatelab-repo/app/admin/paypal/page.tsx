import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { paypalAccessToken } from "@/lib/paypal";
import { createClient, requireAdmin } from "@/lib/supabase/server";
import { initializePayPalSubscription } from "@/app/admin/paypal/actions";

export const dynamic = "force-dynamic";

export default async function PayPalAdminPage({ searchParams }: { searchParams: Promise<{ setup?: string; error?: string }> }) {
  if (!await requireAdmin()) redirect("/login?next=/admin/paypal");
  const params = await searchParams;

  const requiredVariables = [
    "NEXT_PUBLIC_PAYPAL_CLIENT_ID",
    "PAYPAL_CLIENT_SECRET",
    "PAYPAL_WEBHOOK_ID",
    "SUPABASE_SECRET_KEY",
  ];
  const missing = requiredVariables.filter((name) => !process.env[name]);
  let connected = false;

  if (missing.length === 0) {
    try {
      await paypalAccessToken();
      connected = true;
    } catch {
      connected = false;
    }
  }

  const supabase = await createClient();
  const { data: planSetting } = await supabase.from("storefront_settings").select("value")
    .eq("key", "paypal_membership_plan_id").maybeSingle();

  return <main><SiteHeader/><section className="portal shell narrowPortal">
    <div className="portalTitle"><div><p className="kicker dark">Admin · payments</p><h1>PayPal Sandbox</h1></div><Link href="/admin">← Control centre</Link></div>
    <article className="dashboardCard">
      <span>CONNECTION STATUS</span>
      <h2>{connected ? "Connected" : missing.length ? "Configuration incomplete" : "Credentials rejected"}</h2>
      <p>{connected
        ? "PayPal accepted the secured Sandbox credentials. No payment was created during this check."
        : missing.length
          ? `Missing Vercel variables: ${missing.join(", ")}`
          : "PayPal did not accept the configured Sandbox credentials. Recheck the Client ID and Secret in Vercel."}</p>
      <p><b>Environment:</b> Sandbox</p>
      <p><b>Webhook endpoint:</b> /api/paypal/webhook</p>
    </article>
    <article className="dashboardCard">
      <span>BLUEPRINT MEMBERSHIP</span>
      <h2>{planSetting?.value ? "$9.99 monthly plan active" : "Subscription plan not created"}</h2>
      <p>{planSetting?.value
        ? `Sandbox plan ID: ${planSetting.value}`
        : "Create the PayPal product and recurring monthly plan from this secured admin page."}</p>
      {params.setup === "created" && <p className="formMessage">Subscription plan created successfully.</p>}
      {params.error && <p className="formMessage">PayPal could not complete setup. Check the Sandbox credentials and try again.</p>}
      {!planSetting?.value && connected && <form action={initializePayPalSubscription}>
        <button className="button primary" type="submit">Create $9.99 Sandbox plan</button>
      </form>}
    </article>
  </section></main>;
}
