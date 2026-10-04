"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function CancelMembershipButton({ renewsOn }: { renewsOn: string | null }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function cancel() {
    if (!window.confirm(`Cancel your membership? You won't be billed again${renewsOn ? `, and you keep access until ${renewsOn}` : ""}.`)) return;
    setBusy(true);
    setError("");
    const response = await fetch("/api/paystack/cancel-subscription", { method: "POST" }).catch(() => null);
    const data = await response?.json().catch(() => ({})) as { error?: string } | undefined;
    if (response?.ok) setMessage(`Membership cancelled. You won't be billed again${renewsOn ? `; access continues until ${renewsOn}` : ""}.`);
    else setError(data?.error || "The membership could not be cancelled. Use Contact us and we'll cancel it for you.");
    setBusy(false);
  }

  if (message) return <p className="formMessage" role="status">{message}</p>;
  return <div>
    <button className="textButtonLink" onClick={cancel} disabled={busy}>{busy ? "Cancelling…" : "Cancel membership"}</button>
    {error && <p className="formError" role="alert">{error}</p>}
  </div>;
}

export function ResumeMembershipButton({ accessUntil }: { accessUntil: string | null }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function resume() {
    setBusy(true);
    setError("");
    const response = await fetch("/api/paystack/resume-subscription", { method: "POST" }).catch(() => null);
    const data = await response?.json().catch(() => ({})) as { error?: string } | undefined;
    if (response?.ok) { setMessage(`Membership resumed. R179 will be charged to your saved card${accessUntil ? ` on ${accessUntil}` : ""}, then monthly.`); window.setTimeout(() => window.location.reload(), 2500); }
    else setError(data?.error || "The membership could not be resumed. Use Contact us and we'll help.");
    setBusy(false);
  }

  if (message) return <p className="formMessage" role="status">{message}</p>;
  return <div>
    <p>Changed your mind? Resume to keep your access after {accessUntil || "your paid period"}. Nothing is charged today.</p>
    <button className="button primary" onClick={resume} disabled={busy}>{busy ? "Resuming…" : "Resume membership →"}</button>
    {error && <p className="formError" role="alert">{error}</p>}
  </div>;
}

export function PasswordForm() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const password = String(new FormData(form).get("password") || "");
    const confirm = String(new FormData(form).get("confirm") || "");
    setError("");
    setMessage("");
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("The passwords don't match.");
    setBusy(true);
    const { error: updateError } = await createClient().auth.updateUser({ password });
    if (updateError) setError(updateError.message);
    else { setMessage("Password saved. You can now sign in with your email and password."); form.reset(); }
    setBusy(false);
  }

  return <form className="authForm compactForm" onSubmit={submit}>
    <label>New password<input name="password" type="password" required minLength={8} autoComplete="new-password" /></label>
    <label>Confirm password<input name="confirm" type="password" required minLength={8} autoComplete="new-password" /></label>
    <button className="button darkButton" disabled={busy}>{busy ? "Saving…" : "Save password"}</button>
    {message && <p className="formMessage" role="status">{message}</p>}
    {error && <p className="formError" role="alert">{error}</p>}
  </form>;
}
