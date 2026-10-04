import { normaliseReference } from "@/lib/booking";
import { toBookingView } from "@/lib/booking-view";
import { isEmail } from "@/lib/contact";
import { apiError, isSameOrigin } from "@/lib/http";
import { createAdminClientInstance } from "@/lib/supabase/server";

// Public lookup: reference + matching email. Returns session and status only, never contact details.
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return apiError("Invalid request origin.", 403);
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const reference = normaliseReference(body.reference);
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const notFound = () => apiError("We couldn't find a booking with that reference and email.", 404);
  if (!reference || !isEmail(email)) return notFound();

  const supabase = createAdminClientInstance();
  const { data: booking } = await supabase.from("course_bookings")
    .select("reference,email,payment_id,course_sessions(title,starts_at,duration_minutes,timezone)")
    .eq("reference", reference).maybeSingle();
  const session = Array.isArray(booking?.course_sessions) ? booking.course_sessions[0] : booking?.course_sessions;
  if (!booking || !session || booking.email.toLowerCase() !== email.toLowerCase()) return notFound();

  const { data: registration } = await supabase.from("registrations").select("status").eq("payment_id", booking.payment_id).maybeSingle();
  return Response.json({ booking: toBookingView(booking, session, registration?.status || null, false) });
}
