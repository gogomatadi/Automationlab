"use client";

import { FormEvent, useState } from "react";
import { accountTopics, contactTopics, type ContactTopic } from "@/lib/contact";

export function ContactForm({ signedInEmail, initialTopic }: { signedInEmail: string | null; initialTopic: ContactTopic }) {
  const [topic, setTopic] = useState<ContactTopic>(initialTopic);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sentId, setSentId] = useState("");
  const needsSignIn = accountTopics.includes(topic) && !signedInEmail;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form)),
      });
      const data = await response.json() as { requestId?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "Your message could not be sent.");
      setSentId(data.requestId || "sent");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your message could not be sent.");
    }
    setBusy(false);
  }

  if (sentId) return <div className="emptyState"><h2>Message received.</h2><p>{accountTopics.includes(topic) ? "We've emailed you a confirmation of your request." : "We'll reply by email as soon as we can."}</p></div>;

  return <form className="authForm" onSubmit={submit}>
    <label>What is this about?
      <select name="topic" value={topic} onChange={(event) => setTopic(event.target.value as ContactTopic)}>
        {Object.entries(contactTopics).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </label>
    {needsSignIn ? <p>To protect your account, cancellations and refunds can only be requested while signed in. <a className="button primary" href={`/login?next=${encodeURIComponent(`/contact?topic=${topic}`)}`}>Sign in to continue →</a></p> : <>
      <label>Your name<input name="name" maxLength={100} autoComplete="name" /></label>
      {signedInEmail ? <p>Replies go to <b>{signedInEmail}</b>.</p> : <label>Your email<input name="email" type="email" required autoComplete="email" /></label>}
      <label>Message<textarea name="message" required minLength={2} maxLength={2000} rows={6} placeholder={topic === "cancel_course" ? "Which session would you like to cancel?" : ""} /></label>
      <input name="website" tabIndex={-1} autoComplete="off" className="honeypot" aria-hidden="true" />
      <button className="button primary" disabled={busy}>{busy ? "Sending…" : "Send message →"}</button>
    </>}
    {error && <p className="formError" role="alert">{error}</p>}
  </form>;
}
