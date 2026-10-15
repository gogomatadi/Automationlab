"use client";

import { useState } from "react";

type State = "idle" | "working" | "done" | "error";

// A link scanner in some email clients fetches links automatically. Requiring a click
// before we record anything keeps those automated hits from opting people out by mistake.
export function UnsubscribeForm({ token }: { token: string }) {
  const [state, setState] = useState<State>("idle");

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

  if (state === "done") {
    return (
      <>
        <h1>You&apos;re unsubscribed</h1>
        <p>You won&apos;t receive any more marketing emails from AutomateLab. If you unsubscribed by mistake, just reply to any earlier email and we&apos;ll add you back.</p>
      </>
    );
  }

  return (
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
  );
}
