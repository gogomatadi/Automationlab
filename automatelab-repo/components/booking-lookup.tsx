"use client";

import { FormEvent, useState } from "react";
import { BookingCard } from "@/components/booking-card";
import type { BookingView } from "@/lib/booking-view";

export function BookingLookup({ initialReference }: { initialReference: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [booking, setBooking] = useState<BookingView | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setBooking(null);
    const response = await fetch("/api/booking/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))),
    }).catch(() => null);
    const data = await response?.json().catch(() => ({})) as { booking?: BookingView; error?: string } | undefined;
    if (response?.ok && data?.booking) setBooking(data.booking);
    else setError(data?.error || "The lookup failed. Please try again.");
    setBusy(false);
  }

  return <>
    <form className="authForm" onSubmit={submit}>
      <label>Booking reference<input name="reference" required defaultValue={initialReference} placeholder="AL-XXXXXX" autoCapitalize="characters" /></label>
      <label>Email used for the booking<input name="email" type="email" required autoComplete="email" /></label>
      <button className="button primary" disabled={busy}>{busy ? "Looking up…" : "Find my booking →"}</button>
      {error && <p className="formError" role="alert">{error}</p>}
    </form>
    {booking && <BookingCard booking={booking} />}
  </>;
}
