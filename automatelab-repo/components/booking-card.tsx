import { bookingStatusLabels, type BookingView } from "@/lib/booking-view";

export function BookingCard({ booking, showActions = false }: { booking: BookingView; showActions?: boolean }) {
  return <article className="bookingCard">
    <div className="bookingHead"><span className="bookingRef">{booking.reference}</span><span className={`statusBadge s-${booking.status}`}>{bookingStatusLabels[booking.status]}</span></div>
    <h3>{booking.sessionTitle}</h3>
    <dl className="detailList">
      <div><dt>Date</dt><dd>{booking.sessionDate}</dd></div>
      <div><dt>Time</dt><dd>{booking.sessionTime}</dd></div>
      {booking.fullName && <div><dt>Attendee</dt><dd>{booking.fullName}{booking.company ? ` · ${booking.company}` : ""}</dd></div>}
      {booking.email && <div><dt>Contact</dt><dd>{booking.email}{booking.phone ? ` · ${booking.phone}` : ""}</dd></div>}
    </dl>
    {showActions && booking.status === "confirmed" && <a className="textLink" href={`/contact?topic=cancel_course&ref=${booking.reference}`}>Need to cancel or move this booking?</a>}
  </article>;
}
