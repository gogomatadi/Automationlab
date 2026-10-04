import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { centsFromPayPal, subscriptionStateForEvent } from "../lib/paypal-events.ts";

test("maps PayPal subscription lifecycle events to access states", () => {
  assert.equal(subscriptionStateForEvent("BILLING.SUBSCRIPTION.ACTIVATED"), "active");
  assert.equal(subscriptionStateForEvent("BILLING.SUBSCRIPTION.PAYMENT.FAILED"), "past_due");
  assert.equal(subscriptionStateForEvent("BILLING.SUBSCRIPTION.CANCELLED"), "cancelled");
  assert.equal(subscriptionStateForEvent("UNKNOWN"), null);
});

test("converts PayPal decimal amounts without accepting malformed values", () => {
  assert.equal(centsFromPayPal("29.00"), 2900);
  assert.equal(centsFromPayPal("9.99"), 999);
  assert.equal(centsFromPayPal("29.001"), null);
  assert.equal(centsFromPayPal("not-money"), null);
});

test("webhook verifies the PayPal signature before opening the admin data path", async () => {
  const source = await readFile(new URL("../app/api/paypal/webhook/route.ts", import.meta.url), "utf8");
  const verifyAt = source.indexOf("verifyPayPalWebhook(request, event)");
  const adminAt = source.indexOf("createAdminClientInstance();");
  assert.ok(verifyAt >= 0 && adminAt > verifyAt);
  assert.match(source, /status: 401/);
});

test("downloads use short-lived server-generated signed URLs", async () => {
  const source = await readFile(new URL("../app/api/download/route.ts", import.meta.url), "utf8");
  assert.match(source, /createSignedUrl\(release\.storage_path, 60/);
  assert.match(source, /eq\("status", "active"\)/);
});

test("client components do not contain server secrets", async () => {
  const files = ["checkout-button.tsx", "login-form.tsx", "release-uploader.tsx"];
  for (const file of files) {
    const source = await readFile(new URL(`../components/${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /SUPABASE_SECRET_KEY|PAYPAL_CLIENT_SECRET|PAYPAL_WEBHOOK_ID/);
  }
});

test("customer and admin pages use caller-scoped Supabase clients", async () => {
  const files = [
    "app/course/page.tsx",
    "app/account/page.tsx",
    "app/admin/page.tsx",
    "app/admin/sessions/page.tsx",
    "app/admin/releases/page.tsx",
    "app/api/download/route.ts",
    "app/api/admin/releases/upload-url/route.ts",
    "app/api/admin/releases/finalize/route.ts",
  ];
  for (const file of files) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /createAdminClientInstance/);
    assert.match(source, /createClient/);
  }
});

test("RLS migration protects admin and release storage operations", async () => {
  const source = await readFile(new URL("../supabase/migrations/20260816171040_enable_rls_storefront_clients.sql", import.meta.url), "utf8");
  assert.match(source, /auth\.jwt\(\)->>'email'/);
  assert.doesNotMatch(source, /user_metadata|raw_user_meta_data/);
  assert.match(source, /bucket_id = 'blueprint-releases'/);
  assert.match(source, /security invoker/);
  assert.match(source, /Active members read release objects/);

  const optimized = await readFile(new URL("../supabase/migrations/20260816171213_optimize_storefront_rls_policies.sql", import.meta.url), "utf8");
  assert.match(optimized, /\(select auth\.jwt\(\)\)/);
  assert.match(optimized, /Authorized users read release objects/);
  assert.match(optimized, /Users and admin read allowed entitlements/);
});

test("deployment exposes an immutable release evidence endpoint", async () => {
  const source = await readFile(new URL("../lib/release.ts", import.meta.url), "utf8");
  const route = await readFile(new URL("../app/api/version/route.ts", import.meta.url), "utf8");
  assert.match(source, /automatelab-20260823-v2-100-6649ca94/);
  assert.match(route, /VERCEL_DEPLOYMENT_ID/);
  assert.match(route, /Cache-Control.*no-store/);
});

test("checkout fails closed until PayPal and server credentials exist", async () => {
  const files = ["create-order", "create-subscription"];
  for (const file of files) {
    const source = await readFile(new URL(`../app/api/paypal/${file}/route.ts`, import.meta.url), "utf8");
    assert.match(source, /SUPABASE_SECRET_KEY/);
    assert.match(source, /PAYPAL_CLIENT_SECRET/);
    assert.match(source, /No (payment|subscription) has been started/);
    assert.match(source, /503/);
  }
});

test("database migrations apply in dependency order", async () => {
  const migrations = (await readdir(new URL("../supabase/migrations/", import.meta.url))).sort();
  const initial = migrations.findIndex((name) => name.endsWith("storefront_initial_schema.sql"));
  const hardening = migrations.findIndex((name) => name.endsWith("harden_storefront_indexes.sql"));
  const enableRls = migrations.findIndex((name) => name.endsWith("enable_rls_storefront_clients.sql"));
  const optimizeRls = migrations.findIndex((name) => name.endsWith("optimize_storefront_rls_policies.sql"));
  const capacityLimit = migrations.findIndex((name) => name.endsWith("limit_course_session_capacity.sql"));
  const storefrontSettings = migrations.findIndex((name) => name.endsWith("add_storefront_settings.sql"));
  assert.ok(initial >= 0 && initial < hardening && hardening < enableRls && enableRls < optimizeRls && optimizeRls < capacityLimit && capacityLimit < storefrontSettings);
});

test("course sessions are capped at ten seats in UI, server, and database", async () => {
  const page = await readFile(new URL("../app/admin/sessions/page.tsx", import.meta.url), "utf8");
  const actions = await readFile(new URL("../app/admin/actions.ts", import.meta.url), "utf8");
  const migration = await readFile(new URL("../supabase/migrations/20260817040721_limit_course_session_capacity.sql", import.meta.url), "utf8");
  assert.match(page, /max="10"/);
  assert.match(page, /defaultValue="10"/);
  assert.match(actions, /capacity > 10/);
  assert.match(migration, /check \(capacity between 1 and 10\)/i);
});

test("PayPal diagnostics are admin-only and do not create a payment", async () => {
  const source = await readFile(new URL("../app/admin/paypal/page.tsx", import.meta.url), "utf8");
  assert.match(source, /requireAdmin/);
  assert.match(source, /paypalAccessToken/);
  assert.match(source, /No payment was created/);
  assert.doesNotMatch(source, /create-order|create-subscription/);
});

test("PayPal membership plan setup is admin-only and stores its plan ID", async () => {
  const action = await readFile(new URL("../app/admin/paypal/actions.ts", import.meta.url), "utf8");
  const checkout = await readFile(new URL("../app/api/paypal/create-subscription/route.ts", import.meta.url), "utf8");
  const migration = await readFile(new URL("../supabase/migrations/20260817201608_add_storefront_settings.sql", import.meta.url), "utf8");
  assert.match(action, /requireAdmin/);
  assert.match(action, /\/v1\/catalogs\/products/);
  assert.match(action, /\/v1\/billing\/plans/);
  assert.match(action, /"9\.99"/);
  assert.match(action, /paypal_membership_plan_id/);
  assert.match(checkout, /paypal_membership_plan_id/);
  assert.doesNotMatch(checkout, /NEXT_PUBLIC_PAYPAL_SUBSCRIPTION_PLAN_ID/);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /Storefront admin/);
});

test("abandoned PayPal subscriptions can resume or cancel without blocking checkout", async () => {
  const checkout = await readFile(new URL("../app/api/paypal/create-subscription/route.ts", import.meta.url), "utf8");
  const cancel = await readFile(new URL("../app/paypal/subscription-cancel/route.ts", import.meta.url), "utf8");
  assert.match(checkout, /APPROVAL_PENDING/);
  assert.match(checkout, /resumed: true/);
  assert.match(checkout, /paypal\/subscription-cancel/);
  assert.doesNotMatch(checkout, /A membership checkout is already pending/);
  assert.match(cancel, /status: "cancelled"/);
  assert.match(cancel, /requireUser/);
});

test("login offers Google OAuth with the existing secure callback", async () => {
  const source = await readFile(new URL("../components/login-form.tsx", import.meta.url), "utf8");
  assert.match(source, /signInWithOAuth/);
  assert.match(source, /provider: "google"/);
  assert.match(source, /\/auth\/callback\?next=/);
  assert.doesNotMatch(source, /GOOGLE_CLIENT_SECRET|GOOGLE_CLIENT_ID/);
});

test("release upload keeps a stable form reference across async requests", async () => {
  const source = await readFile(new URL("../components/release-uploader.tsx", import.meta.url), "utf8");
  const captureAt = source.indexOf("const formElement = event.currentTarget");
  const firstAwaitAt = source.indexOf("await fetch");
  assert.ok(captureAt >= 0 && captureAt < firstAwaitAt);
  assert.match(source, /formElement\.reset\(\)/);
  assert.doesNotMatch(source, /event\.currentTarget\.reset\(\)/);
});

test("storefront and release manager advertise the current 100-blueprint library", async () => {
  const files = [
    "app/page.tsx",
    "app/library/page.tsx",
    "app/layout.tsx",
    "components/release-uploader.tsx",
  ];
  for (const file of files) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
    assert.match(source, /100/);
    assert.doesNotMatch(source, /\b84\b/);
  }
});

test("legal pages exist and the footer links to them", async () => {
  for (const file of ["app/privacy/page.tsx", "app/terms/page.tsx"]) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
    assert.match(source, /LegalPage/);
  }
  const home = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(home, /href="\/privacy"/);
  assert.match(home, /href="\/terms"/);
  assert.doesNotMatch(home, /href="#">(Privacy|Terms)</);
});

test("keep-alive performs a real throttled database write", async () => {
  const source = await readFile(new URL("../app/api/keepalive/route.ts", import.meta.url), "utf8");
  const vercel = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
  assert.match(source, /\.upsert\(/);
  assert.match(source, /MIN_INTERVAL_MS/);
  assert.ok(vercel.crons.some((cron) => cron.path === "/api/keepalive"));
});

test("contact form requires sign-in for cancellations and keeps the webhook server-side", async () => {
  const route = await readFile(new URL("../app/api/contact/route.ts", import.meta.url), "utf8");
  const form = await readFile(new URL("../components/contact-form.tsx", import.meta.url), "utf8");
  const lib = await readFile(new URL("../lib/contact.ts", import.meta.url), "utf8");
  assert.match(lib, /accountTopics: ContactTopic\[\] = \["cancel_course", "cancel_membership", "refund"\]/);
  assert.match(route, /needsAccount && !user\?\.email/);
  assert.match(route, /status: 401|, 401\)/);
  assert.match(route, /const email = user\?\.email \|\|/);
  assert.match(route, /isSameOrigin/);
  assert.match(route, /escapeHtml\(message\)/);
  assert.doesNotMatch(form, /hook\.[a-z0-9]+\.make\.com|MAKE_CONTACT_WEBHOOK_URL/);
  assert.doesNotMatch(route, /hook\.[a-z0-9]+\.make\.com/);
});

test("contact page is linked from the header, footer and customer portal", async () => {
  const header = await readFile(new URL("../components/site-header.tsx", import.meta.url), "utf8");
  const home = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const account = await readFile(new URL("../app/account/page.tsx", import.meta.url), "utf8");
  assert.match(header, /href="\/contact"/);
  assert.match(home, /href="\/contact"/);
  assert.match(account, /href="\/contact"/);
  assert.match(account, /CancelMembershipButton/);
});

test("course bookings capture attendee details and a reference before payment", async () => {
  const order = await readFile(new URL("../app/api/paystack/create-order/route.ts", import.meta.url), "utf8");
  const migration = await readFile(new URL("../supabase/migrations/20261004120000_course_bookings.sql", import.meta.url), "utf8");
  const booking = await readFile(new URL("../lib/booking.ts", import.meta.url), "utf8");
  assert.match(order, /parseAttendee\(body\)/);
  assert.match(order, /from\("course_bookings"\)\.insert/);
  assert.ok(order.indexOf("parseAttendee(body)") < order.indexOf("/transaction/initialize"));
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /user_id = \(select auth\.uid\(\)\)/);
  assert.doesNotMatch(migration, /grant (insert|update|delete)[^;]*course_bookings[^;]*authenticated/i);
  assert.match(booking, /crypto\.getRandomValues/);
});

test("booking lookup needs the matching email and never returns contact details", async () => {
  const lookup = await readFile(new URL("../app/api/booking/lookup/route.ts", import.meta.url), "utf8");
  assert.match(lookup, /booking\.email\.toLowerCase\(\) !== email\.toLowerCase\(\)/);
  assert.match(lookup, /toBookingView\(booking, session, registration\?\.status \|\| null, false\)/);
  assert.match(lookup, /isSameOrigin/);
});

test("booking confirmation is claimed once before posting to Make", async () => {
  const notify = await readFile(new URL("../lib/notify.ts", import.meta.url), "utf8");
  const webhook = await readFile(new URL("../app/api/paystack/webhook/route.ts", import.meta.url), "utf8");
  const ret = await readFile(new URL("../app/paystack/course-return/route.ts", import.meta.url), "utf8");
  assert.match(notify, /\.is\("confirmation_sent_at", null\)/);
  assert.match(notify, /confirmation_sent_at: null/);
  assert.match(webhook, /sendBookingConfirmation/);
  assert.match(ret, /sendBookingConfirmation/);
  assert.ok(webhook.indexOf("verifyPaystackSignature(raw") < webhook.indexOf("sendBookingConfirmation(supabase"));
});

test("cancelled memberships keep access until the paid period ends", async () => {
  const migration = await readFile(new URL("../supabase/migrations/20261004120000_course_bookings.sql", import.meta.url), "utf8");
  const cancel = await readFile(new URL("../app/api/paystack/cancel-subscription/route.ts", import.meta.url), "utf8");
  assert.match(migration, /p_status = 'cancelled'\s+and coalesce\(p_period_end, public\.entitlements\.expires_at\) > now\(\)/);
  assert.match(cancel, /\/subscription\/disable/);
  assert.match(cancel, /requireUser/);
  assert.doesNotMatch(cancel, /\.or\(/);
});

test("admin sessions are priced in rand and entered in South African time", async () => {
  const actions = await readFile(new URL("../app/admin/actions.ts", import.meta.url), "utf8");
  assert.match(actions, /currency: "ZAR"/);
  assert.doesNotMatch(actions, /price_cents: 2900|currency: "USD"/);
  assert.match(actions, /sastInputToIso/);
  assert.match(actions, /export async function updateCourseSession/);
});

test("login supports email and password alongside Google and email links", async () => {
  const source = await readFile(new URL("../components/login-form.tsx", import.meta.url), "utf8");
  assert.match(source, /signInWithPassword/);
  assert.match(source, /auth\.signUp/);
  assert.match(source, /resetPasswordForEmail/);
  assert.match(source, /signInWithOtp/);
});

test("checkout refuses a second booking for the same account before Paystack is called", async () => {
  const order = await readFile(new URL("../app/api/paystack/create-order/route.ts", import.meta.url), "utf8");
  const guard = order.indexOf("You're already booked on this session");
  assert.ok(guard > 0 && guard < order.indexOf("/transaction/initialize"));
  assert.match(order, /\.eq\("email", user\.email\)\.neq\("status", "cancelled"\)/);
});

test("sign-up replaces the form with a prominent check-your-email panel", async () => {
  const source = await readFile(new URL("../components/login-form.tsx", import.meta.url), "utf8");
  const home = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /setSentTo\(\{ email, kind: "signup" \}\)/);
  assert.match(source, /<h2>Check your email<\/h2>/);
  assert.match(source, /auth\.resend\(/);
  assert.match(home, /className="navCta" href="\/account"/);
});

test("a cancelled membership can be resumed while the paid period runs", async () => {
  const resume = await readFile(new URL("../app/api/paystack/resume-subscription/route.ts", import.meta.url), "utf8");
  const account = await readFile(new URL("../app/account/page.tsx", import.meta.url), "utf8");
  assert.match(resume, /\/subscription\/enable/);
  assert.match(resume, /requireUser/);
  assert.match(resume, /current_period_end\) <= new Date\(\)/);
  assert.match(account, /status === "cancelled" && <ResumeMembershipButton/);
});

test("membership checkout uses the live plan code only with a live secret key", async () => {
  const lib = await readFile(new URL("../lib/paystack.ts", import.meta.url), "utf8");
  const route = await readFile(new URL("../app/api/paystack/create-subscription/route.ts", import.meta.url), "utf8");
  assert.match(lib, /startsWith\("sk_live_"\) \? "paystack_membership_plan_code_live" : "paystack_membership_plan_code"/);
  assert.match(route, /membershipPlanSettingKey\(\)/);
});
