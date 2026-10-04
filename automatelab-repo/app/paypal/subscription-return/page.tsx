import { SiteHeader } from "@/components/site-header";

export default function SubscriptionReturnPage() {
  return <main><SiteHeader/><section className="portal shell narrowPortal">
    <p className="kicker dark">Payment received</p><h1>PayPal is confirming your membership.</h1>
    <p>Access is granted only after PayPal sends a verified activation event. This normally takes a few seconds.</p>
    <a className="button primary" href="/account">Check My access →</a>
  </section></main>;
}
