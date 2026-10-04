# Paystack checkout — what changed & how to finish

## What this change does
- Adds **Paystack** as the payment provider, feeding the **existing `entitlements` table**.
  Access logic (download gate, storage RLS, course registration) is unchanged.
- **PayPal is now dormant**: the checkout buttons call Paystack; PayPal code is left in place
  as a fallback but nothing triggers it.
- All amounts are **ZAR** (Paystack South Africa settles in ZAR only).

## New / changed files
New:
- `lib/paystack.ts`                               — REST helper + webhook HMAC-SHA512 verify
- `lib/paystack-events.ts`                        — event → subscription_status mapping
- `app/api/paystack/create-order/route.ts`        — course checkout (ZAR), reserves the seat
- `app/api/paystack/create-subscription/route.ts` — membership checkout (plan)
- `app/api/paystack/webhook/route.ts`             — verifies, dedupes, GRANTS access
- `app/paystack/course-return/route.ts`           — post-payment confirm (webhook is backup)
- `supabase/migrations/20261003120000_paystack_support.sql`
Changed:
- `lib/env.ts`                 — adds PAYSTACK_SECRET_KEY
- `components/checkout-button.tsx`, `app/course/page.tsx`, `app/library/page.tsx`, `app/page.tsx`
                               — buttons point to Paystack; copy de-PayPal'd; ZAR formatting

## Finish-up checklist (in order)
1. **Apply the migration** to Supabase (SQL editor → paste the new migration file, run).
   Adds `paystack_*` columns, a `paystack_webhook_events` table, and 3 security-definer RPCs
   (reserve / confirm course, sync library subscription) granted to service_role only.
2. **Set env vars** in Vercel (Preview first, then Production):
   - `PAYSTACK_SECRET_KEY` = your `sk_test_…` (switch to `sk_live_…` for production)
   - confirm `SUPABASE_SECRET_KEY` and `NEXT_PUBLIC_SITE_URL` are set
3. **Paystack dashboard → Webhooks**: set the URL to `<site>/api/paystack/webhook`
   (test URL = your preview deployment; live URL = production).
4. **Create the ZAR course session** (published) with the ZAR price in cents
   (e.g. R1,499 → price_cents = 149900, currency = 'ZAR', status = 'published', capacity ≤ 10).
5. **(Membership only)** create a Paystack **Plan** (monthly, ZAR), then store its code:
   `storefront_settings` key `paystack_membership_plan_code` = `PLN_…`.
6. **Test**: sign in → /course → pay with a Paystack test card → you land on /account with
   the registration + an active `course` entitlement. Library download unlocks on an active
   `library` entitlement.

## Notes
- `confirm`/`reserve`/`sync` RPCs are idempotent and dedupe on the Paystack reference /
  subscription code, so a re-sent webhook can never double-grant.
- Course price is read from the DB row — no price is hardcoded in the app.
