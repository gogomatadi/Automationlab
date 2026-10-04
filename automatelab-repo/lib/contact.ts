export const contactTopics = {
  general: "General question",
  cancel_course: "Cancel a course registration",
  cancel_membership: "Cancel my membership",
  refund: "Request a refund",
} as const;

export type ContactTopic = keyof typeof contactTopics;

// Cancellations and refunds must come from a signed-in account so replies only go to a verified owner.
export const accountTopics: ContactTopic[] = ["cancel_course", "cancel_membership", "refund"];

export function isContactTopic(value: unknown): value is ContactTopic {
  return typeof value === "string" && Object.hasOwn(contactTopics, value);
}

export function isEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
