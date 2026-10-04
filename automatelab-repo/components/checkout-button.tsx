"use client";

import { useState } from "react";

type Props = {
  kind: "course" | "library";
  courseSessionId?: string;
  label: string;
};

export function CheckoutButton({ kind, courseSessionId, label }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function startCheckout() {
    setBusy(true);
    setError("");
    try {
      const endpoint = kind === "course" ? "/api/paystack/create-order" : "/api/paystack/create-subscription";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(courseSessionId ? { courseSessionId } : {}),
      });
      const data = await response.json() as { authorizationUrl?: string; error?: string };
      if (!response.ok || !data.authorizationUrl) throw new Error(data.error || "Checkout could not start.");
      window.location.assign(data.authorizationUrl);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Checkout could not start.");
      setBusy(false);
    }
  }

  return <div>
    <button className="button primary full" onClick={startCheckout} disabled={busy}>
      {busy ? "Opening secure checkout…" : label}
    </button>
    {error && <p className="formError" role="alert">{error}</p>}
  </div>;
}
