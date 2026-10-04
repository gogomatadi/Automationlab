# AutomateLab storefront

Next.js storefront for the AutomateLab Make.com blueprint membership and live course.

## Products

- Blueprint library: USD 9.99/month through PayPal Subscriptions
- Live build course: USD 29 once-off through PayPal Orders

## Architecture

- Vercel hosts the Next.js application.
- Supabase provides passwordless authentication, Postgres, and a private Storage bucket named `blueprint-releases`.
- PayPal webhooks are verified with PayPal before any subscription, payment, registration, or entitlement is changed.
- Download links are generated server-side and expire after 60 seconds.
- `/admin` is restricted server-side to `ADMIN_EMAIL`.

Copy `.env.example` to `.env.local` for development. Never expose `SUPABASE_SECRET_KEY`, `PAYPAL_CLIENT_SECRET`, or `PAYPAL_WEBHOOK_ID` in client-side variables.

## Verification

```bash
npm install
npm run verify
```

Production setup also requires applying `supabase/migrations`, creating the private Storage bucket, setting all environment variables in Vercel, registering `/api/paypal/webhook` in PayPal, and running sandbox acceptance tests before switching `PAYPAL_ENVIRONMENT` to `live`.
