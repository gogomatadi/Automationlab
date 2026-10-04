"use client";

import { FormEvent, useState } from "react";

export function BookingForm({ courseSessionId, accountEmail, priceLabel }: { courseSessionId: string; accountEmail: string; priceLabel: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/paystack/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...Object.fromEntries(new FormData(event.currentTarget)), courseSessionId }),
      });
      const data = await response.json() as { authorizationUrl?: string; error?: string };
      if (!response.ok || !data.authorizationUrl) throw new Error(data.error || "Checkout could not start.");
      window.location.assign(data.authorizationUrl);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Checkout could not start.");
      setBusy(false);
    }
  }

  if (!open) return <button className="button primary full" onClick={() => setOpen(true)}>Book this session →</button>;

  return <form className="authForm bookingForm" onSubmit={submit}>
    <label>Full name<input name="fullName" required minLength={2} maxLength={100} autoComplete="name" /></label>
    <label>Email for your confirmation<input name="email" type="email" required defaultValue={accountEmail} autoComplete="email" /></label>
    <label>Phone number<input name="phone" type="tel" required pattern="\+?[0-9 ()\-]{6,30}" placeholder="+27 82 123 4567" autoComplete="tel" /></label>
    <label>Company / business <i>(optional)</i><input name="company" maxLength={120} autoComplete="organization" /></label>
    <label>What do you want to automate? <i>(optional)</i><textarea name="goal" maxLength={1000} rows={3} placeholder="e.g. lead follow-up, invoicing, social posts" /></label>
    <button className="button primary full" disabled={busy}>{busy ? "Opening secure checkout…" : `Continue to payment · ${priceLabel} →`}</button>
    <small>You&apos;ll get a booking reference once payment is confirmed. See our <a href="/terms">refund policy</a>.</small>
    {error && <p className="formError" role="alert">{error}</p>}
  </form>;
}
