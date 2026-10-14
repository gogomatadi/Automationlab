"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SiteHeader } from "@/components/site-header";

type State = "idle" | "working" | "done" | "error";

function UnsubscribeInner() {
  const params = useSearchParams();
  const token = (params.get("t") || "").trim();
  const [state, setState] = useState<State>("idle");

  // A link scanner in some email clients fetches links automatically. Requiring a click
  // before we record anything keeps those automated hits from opting people out by mistake.
  async function confirm() {
    setState("working");
    try {
      const res = await fetch("/api/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  return (
    <main>
      <SiteHeader />
      <section className="portal shell narrowPortal legal">
        <p className="kicker dark">Email preferences</p>

        {!token && (
          <>
            <h1>We couldn&apos;t process that link</h1>
            <p>The unsubscribe link looks incomplete. Email <a href="mailto:business@massuba.com">business@massuba.com</a> and we&apos;ll remove you right away.</p>
          </>
        )}

        {token && state !== "done" && (
          <>
            <h1>Unsubscribe from AutomateLab emails</h1>
            <p>Click the button below and we&apos;ll stop sending you marketing emails from AutomateLab.</p>
            <p>
              <button className="button primary" onClick={confirm} disabled={state === "working"}>
                {state === "working" ? "Unsubscribing…" : "Confirm unsubscribe"}
              </button>
            </p>
            {state === "error" && (
              <p>Something went wrong. Please try again, or email <a href="mailto:business@massuba.com">business@massuba.com</a> and we&apos;ll remove you.</p>
            )}
          </>
        )}

        {token && state === "done" && (
          <>
            <h1>You&apos;re unsubscribed</h1>
            <p>You won&apos;t receive any more marketing emails from AutomateLab. If you unsubscribed by mistake, just reply to any earlier email and we&apos;ll add you back.</p>
          </>
        )}
      </section>
    </main>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={null}>
      <UnsubscribeInner />
    </Suspense>
  );
}
