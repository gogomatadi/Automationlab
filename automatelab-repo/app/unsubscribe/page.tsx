import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { UnsubscribeForm } from "./unsubscribe-form";

export const metadata: Metadata = { title: "Unsubscribe | AutomateLab" };

// Server component so it can use SiteHeader (which reads auth state server-side).
// The interactive opt-out lives in the UnsubscribeForm client child.
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  const token = (t || "").trim();

  return (
    <main>
      <SiteHeader />
      <section className="portal shell narrowPortal legal">
        <p className="kicker dark">Email preferences</p>
        {!token ? (
          <>
            <h1>We couldn&apos;t process that link</h1>
            <p>The unsubscribe link looks incomplete. Email <a href="mailto:business@massuba.com">business@massuba.com</a> and we&apos;ll remove you right away.</p>
          </>
        ) : (
          <UnsubscribeForm token={token} />
        )}
      </section>
    </main>
  );
}
