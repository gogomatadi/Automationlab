import { SiteHeader } from "@/components/site-header";

export const legalUpdated = "4 October 2026";

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return <main><SiteHeader/><section className="portal shell narrowPortal legal">
    <p className="kicker dark">Legal</p><h1>{title}</h1>
    <p>Last updated {legalUpdated}</p>
    {children}
  </section></main>;
}
