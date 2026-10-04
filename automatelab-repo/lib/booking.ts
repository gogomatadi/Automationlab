import { isEmail } from "@/lib/contact";

// No 0/O, 1/I: references are read aloud and typed in by customers.
const referenceAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function newBookingReference() {
  // 32 symbols divide 256 evenly, so a byte modulo 32 has no bias.
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `AL-${Array.from(bytes, (byte) => referenceAlphabet[byte % 32]).join("")}`;
}

export function normaliseReference(value: unknown) {
  const ref = typeof value === "string" ? value.trim().toUpperCase().replace(/\s+/g, "") : "";
  return /^AL-[A-HJ-NP-Z2-9]{6}$/.test(ref) ? ref : null;
}

export type AttendeeDetails = { fullName: string; email: string; phone: string; company: string | null; goal: string | null };

export function parseAttendee(body: Record<string, unknown>): AttendeeDetails | string {
  const text = (key: string) => typeof body[key] === "string" ? (body[key] as string).trim() : "";
  const fullName = text("fullName");
  const email = text("email");
  const phone = text("phone");
  const company = text("company");
  const goal = text("goal");
  if (fullName.length < 2 || fullName.length > 100) return "Enter your full name.";
  if (!isEmail(email)) return "Enter a valid email address.";
  if (!/^\+?[0-9 ()-]{6,30}$/.test(phone)) return "Enter a valid phone number.";
  if (company.length > 120) return "Company name is too long.";
  if (goal.length > 1000) return "Keep what you want to automate under 1,000 characters.";
  return { fullName, email, phone, company: company || null, goal: goal || null };
}

// Course times are entered and shown in South African time (UTC+2, no daylight saving).
export const courseTimeZone = "Africa/Johannesburg";

export function sastInputToIso(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00+02:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function isoToSastInput(iso: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: courseTimeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export function formatSessionDate(startsAt: string, timeZone = courseTimeZone) {
  return new Intl.DateTimeFormat("en-ZA", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone }).format(new Date(startsAt));
}

export function formatSessionTime(startsAt: string, durationMinutes: number, timeZone = courseTimeZone) {
  const time = new Intl.DateTimeFormat("en-ZA", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone });
  const start = new Date(startsAt);
  return `${time.format(start)}–${time.format(new Date(start.getTime() + durationMinutes * 60000))} SAST`;
}

export function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency }).format(cents / 100);
}

export function formatDay(iso: string) {
  return new Intl.DateTimeFormat("en-ZA", { day: "numeric", month: "long", year: "numeric", timeZone: courseTimeZone }).format(new Date(iso));
}
