"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({ next = "/account" }: { next?: string }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
    setMessage(error ? error.message : "Check your email for the secure sign-in link.");
    setBusy(false);
  }

  async function signInWithGoogle() {
    setBusy(true);
    setMessage("");
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) {
      setMessage(error.message);
      setBusy(false);
    }
  }

  return <form className="authForm" onSubmit={submit}>
    <button className="button darkButton full" type="button" disabled={busy} onClick={signInWithGoogle}>
      Continue with Google
    </button>
    <p className="formMessage">or use a secure email link</p>
    <label htmlFor="email">Email address</label>
    <input id="email" type="email" required autoComplete="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="you@example.com" />
    <button className="button primary full" disabled={busy}>{busy ? "Sending…" : "Email me a sign-in link"}</button>
    {message && <p className="formMessage" role="status">{message}</p>}
  </form>;
}
