import type { Metadata } from "next";
import { ContactForm } from "@/components/contact-form";
import { SiteHeader } from "@/components/site-header";
import { normaliseReference } from "@/lib/booking";
import { isContactTopic } from "@/lib/contact";
import { requireUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Contact us | AutomateLab" };
export const dynamic = "force-dynamic";

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ topic?: string; ref?: string }> }) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  return <main><SiteHeader/><section className="portal shell narrowPortal">
    <p className="kicker dark">Contact us</p><h1>How can we help?</h1>
    <p>Ask a question, cancel a course registration or membership, or request a refund. Refund requests are handled under our <a href="/terms">refund policy</a>.</p>
    <ContactForm signedInEmail={user?.email || null} initialTopic={isContactTopic(params.topic) ? params.topic : "general"} initialMessage={normaliseReference(params.ref) ? `Booking reference: ${normaliseReference(params.ref)}
` : ""} />
  </section></main>;
}
