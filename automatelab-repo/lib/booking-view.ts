import { formatSessionDate, formatSessionTime } from "@/lib/booking";

export type BookingView = {
  reference: string;
  status: "confirmed" | "awaiting_payment" | "cancelled" | "attended" | "no_show";
  sessionTitle: string;
  sessionDate: string;
  sessionTime: string;
  fullName?: string;
  email?: string;
  phone?: string;
  company?: string | null;
};

export const bookingStatusLabels: Record<BookingView["status"], string> = {
  confirmed: "Confirmed",
  awaiting_payment: "Awaiting payment",
  cancelled: "Cancelled",
  attended: "Attended",
  no_show: "Missed",
};

type Session = { title: string; starts_at: string; duration_minutes: number; timezone: string };

export function toBookingView(
  booking: { reference: string; full_name?: string; email?: string; phone?: string; company?: string | null },
  session: Session,
  registrationStatus: string | null,
  includeContact: boolean,
): BookingView {
  const status = (registrationStatus || "awaiting_payment") as BookingView["status"];
  return {
    reference: booking.reference,
    status: status in bookingStatusLabels ? status : "awaiting_payment",
    sessionTitle: session.title,
    sessionDate: formatSessionDate(session.starts_at, session.timezone),
    sessionTime: formatSessionTime(session.starts_at, session.duration_minutes, session.timezone),
    ...(includeContact ? { fullName: booking.full_name, email: booking.email, phone: booking.phone, company: booking.company } : {}),
  };
}
