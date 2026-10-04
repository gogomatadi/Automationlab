"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Mode = "password" | "signup" | "link" | "reset";

const titles: Record<Mode, string> = {
  password: "Sign in",
  signup: "Create account",
  link: "Email me a sign-in link",
  reset: "Reset password",
};

export function LoginForm({ next = "/account" }: { next?: string }) {
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<{ email: string; kind: "signup" | "link" | "reset" } | null>(null);

  const callback = (target: string) => `${window.location.origin}/auth/callback?next=${encodeURIComponent(target)}`;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    const supabase = createClient();
    if (mode === "password") {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (!signInError) { window.location.assign(next); return; }
      setError(signInError.message === "Invalid login credentials" ? "Email or password is incorrect. If you've only used Google or an email link before, use “Forgot password?” to set one." : signInError.message);
    } else if (mode === "signup") {
      if (password.length < 8) { setError("Use at least 8 characters for your password."); setBusy(false); return; }
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: callback(next) } });
      if (signUpError) setError(signUpError.message);
      else if (data.session) { window.location.assign(next); return; }
      else setSentTo({ email, kind: "signup" });
    } else if (mode === "link") {
      const { error: otpError } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: callback(next) } });
      if (otpError) setError(otpError.message); else setSentTo({ email, kind: "link" });
    } else {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: callback("/account?password=reset") });
      if (resetError) setError(resetError.message); else setSentTo({ email, kind: "reset" });
    }
    setBusy(false);
  }

  async function signInWithGoogle() {
    setBusy(true);
    setMessage("");
    setError("");
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (oauthError) {
      setError(oauthError.message);
      setBusy(false);
    }
  }

  const switchTo = (target: Mode) => () => { setMode(target); setMessage(""); setError(""); setSentTo(null); };

  async function resend() {
    if (!sentTo) return;
    setBusy(true);
    setMessage("");
    setError("");
    const supabase = createClient();
    const { error: resendError } = sentTo.kind === "signup"
      ? await supabase.auth.resend({ type: "signup", email: sentTo.email, options: { emailRedirectTo: callback(next) } })
      : sentTo.kind === "link"
        ? await supabase.auth.signInWithOtp({ email: sentTo.email, options: { emailRedirectTo: callback(next) } })
        : await supabase.auth.resetPasswordForEmail(sentTo.email, { redirectTo: callback("/account?password=reset") });
    if (resendError) setError(resendError.message); else setMessage("Sent again. It can take a minute to arrive.");
    setBusy(false);
  }

  if (sentTo) {
    const action = sentTo.kind === "signup" ? "confirm your account" : sentTo.kind === "link" ? "sign in" : "reset your password";
    return <div className="checkEmail" role="status" aria-live="polite">
      <h2>Check your email</h2>
      <p>We&apos;ve sent a link to <b>{sentTo.email}</b>.</p>
      <p><b>Open that email and click the link to {action}.</b> You can close this page.</p>
      <p>Not there after a few minutes? Check your spam or promotions folder.</p>
      {message && <p className="formMessage">{message}</p>}
      {error && <p className="formError" role="alert">{error}</p>}
      <div className="authSwitch">
        <button type="button" onClick={resend} disabled={busy}>{busy ? "Sending…" : "Send the email again"}</button>
        <button type="button" onClick={switchTo(mode)}>Use a different email</button>
      </div>
    </div>;
  }
  const needsPassword = mode === "password" || mode === "signup";

  return <form className="authForm" onSubmit={submit}>
    <button className="button darkButton full" type="button" disabled={busy} onClick={signInWithGoogle}>
      Continue with Google
    </button>
    <p className="formMessage">or {titles[mode].toLowerCase()} with your email</p>
    <label htmlFor="email">Email address</label>
    <input id="email" type="email" required autoComplete="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="you@example.com" />
    {needsPassword && <>
      <label htmlFor="password">Password</label>
      <input id="password" type="password" required minLength={mode === "signup" ? 8 : 1} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e)=>setPassword(e.target.value)} />
    </>}
    <button className="button primary full" disabled={busy}>{busy ? "Please wait…" : titles[mode]}</button>
    {message && <p className="formMessage" role="status">{message}</p>}
    {error && <p className="formError" role="alert">{error}</p>}
    <div className="authSwitch">
      {mode !== "password" && <button type="button" onClick={switchTo("password")}>Sign in with password</button>}
      {mode !== "signup" && <button type="button" onClick={switchTo("signup")}>Create an account</button>}
      {mode !== "reset" && <button type="button" onClick={switchTo("reset")}>Forgot password?</button>}
      {mode !== "link" && <button type="button" onClick={switchTo("link")}>Email me a link instead</button>}
    </div>
  </form>;
}
