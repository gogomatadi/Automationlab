import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { CheckoutButton } from "@/components/checkout-button";
import { requireUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const user = await requireUser();
  if (!user) redirect("/login?next=/library");
  const params = await searchParams;
  return <main><SiteHeader/><section className="portal shell splitPortal">
    <div><p className="kicker dark">Blueprint membership</p><h1>100 automations now. Every future batch next.</h1><p className="portalLead">Your customer portal unlocks as soon as your card payment is confirmed.</p>
      <ul className="featureList"><li>100 verified Make.com JSON blueprints</li><li>Private, time-limited downloads</li><li>Continuous release updates while active</li><li>Cancel anytime</li></ul>
    </div><div className="priceCard"><div className="priceTop"><span>MEMBERSHIP</span><b>Immediate access</b></div><div className="price"><sup>R</sup><strong>179</strong><span>/month</span></div><p>Secure card subscription.</p><CheckoutButton kind="library" label="Subscribe →"/>{params.checkout === "cancelled" && <p className="formMessage">Checkout cancelled. You can start again whenever you are ready.</p>}<small>Already subscribed? <a href="/account">Open My access</a></small></div>
  </section></main>;
}
