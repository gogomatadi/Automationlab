-- Add Paystack as a payment provider alongside PayPal, feeding the SAME entitlements.
-- PayPal columns/RPCs are left intact so PayPal can remain a dormant fallback.

-- 1. Payments: record provider + Paystack reference (the key we reconcile on).
alter table public.payments add column if not exists provider text not null default 'paypal';
alter table public.payments add column if not exists paystack_reference text;
create unique index if not exists payments_paystack_reference_idx
  on public.payments (paystack_reference) where paystack_reference is not null;

-- 2. Subscriptions: allow Paystack-managed subscriptions (no PayPal id).
alter table public.subscriptions alter column paypal_subscription_id drop not null;
alter table public.subscriptions add column if not exists provider text not null default 'paypal';
alter table public.subscriptions add column if not exists paystack_subscription_code text;
alter table public.subscriptions add column if not exists paystack_email_token text;
alter table public.subscriptions add column if not exists paystack_customer_code text;
create unique index if not exists subscriptions_paystack_code_idx
  on public.subscriptions (paystack_subscription_code) where paystack_subscription_code is not null;

-- 3. Idempotency log for Paystack webhooks (mirrors paypal_webhook_events).
create table if not exists public.paystack_webhook_events (
  event_id text primary key,
  event_type text not null,
  status text not null default 'received' check (status in ('received','processed','failed','ignored')),
  payload jsonb not null,
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);
alter table public.paystack_webhook_events enable row level security;
drop policy if exists "Storefront admin reads paystack webhook events" on public.paystack_webhook_events;
create policy "Storefront admin reads paystack webhook events"
  on public.paystack_webhook_events for select
  to authenticated
  using (lower(coalesce((select auth.jwt())->>'email','')) = 'gogomatadi@gmail.com');

-- 4. Reserve a course seat for a Paystack transaction (mirror of reserve_course_order).
create or replace function public.paystack_reserve_course_order(
  p_user_id uuid,
  p_email text,
  p_course_session_id uuid,
  p_reference text,
  p_amount_cents integer,
  p_currency text,
  p_provider_payload jsonb
) returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_session public.course_sessions;
  v_occupied integer;
  v_payment_id uuid;
begin
  select * into v_session from public.course_sessions where id = p_course_session_id for update;
  if not found or v_session.status <> 'published'
    or (v_session.registration_deadline is not null and v_session.registration_deadline <= now()) then
    raise exception 'Course session is not available';
  end if;
  if p_amount_cents <> v_session.price_cents or p_currency <> v_session.currency then
    raise exception 'Order amount does not match course price';
  end if;
  select
    (select count(*) from public.registrations where course_session_id = v_session.id and status = 'confirmed')
    + (select count(*) from public.payments where course_session_id = v_session.id
         and status in ('created','approved') and created_at > now() - interval '30 minutes')
  into v_occupied;
  if v_occupied >= v_session.capacity then
    raise exception 'Course session is full';
  end if;
  insert into public.payments (
    user_id, email, product_type, course_session_id, paystack_reference,
    amount_cents, currency, provider, provider_payload
  ) values (
    p_user_id, p_email, 'course', p_course_session_id, p_reference,
    p_amount_cents, p_currency, 'paystack', p_provider_payload
  ) returning id into v_payment_id;
  return v_payment_id;
end;
$$;

-- 5. Confirm a paid Paystack course transaction (mirror of confirm_course_payment).
create or replace function public.paystack_confirm_course_payment(
  p_reference text,
  p_provider_payload jsonb
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.payments;
  v_session public.course_sessions;
  v_registration_id uuid;
  v_registration_count integer;
begin
  select * into v_payment from public.payments where paystack_reference = p_reference for update;
  if not found then raise exception 'Unknown Paystack reference'; end if;
  if v_payment.product_type <> 'course' or v_payment.course_session_id is null then
    raise exception 'Reference is not a course payment';
  end if;
  select id into v_registration_id from public.registrations where payment_id = v_payment.id;
  if found then return v_registration_id; end if;
  select * into v_session from public.course_sessions where id = v_payment.course_session_id for update;
  select count(*) into v_registration_count from public.registrations
    where course_session_id = v_session.id and status = 'confirmed';
  if v_registration_count >= v_session.capacity then raise exception 'Course session is full'; end if;
  update public.payments set status = 'paid', provider_payload = p_provider_payload, updated_at = now()
    where id = v_payment.id;
  insert into public.registrations (course_session_id, payment_id, user_id, email)
  values (v_session.id, v_payment.id, v_payment.user_id, v_payment.email)
  on conflict (payment_id) do update set status = 'confirmed'
  returning id into v_registration_id;
  insert into public.entitlements (user_id, email, kind, status, payment_id, course_session_id)
  values (v_payment.user_id, v_payment.email, 'course', 'active', v_payment.id, v_session.id)
  on conflict do nothing;
  return v_registration_id;
end;
$$;

-- 6. Sync a Paystack library subscription into entitlements (upsert; resolve user by email).
create or replace function public.paystack_sync_library_subscription(
  p_subscription_code text,
  p_customer_code text,
  p_email_token text,
  p_email text,
  p_status public.subscription_status,
  p_period_end timestamptz,
  p_provider_payload jsonb
) returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_user_id uuid;
  v_subscription_id uuid;
begin
  select id into v_user_id from auth.users where lower(email) = lower(p_email) limit 1;

  insert into public.subscriptions (
    user_id, email, paystack_subscription_code, paystack_customer_code, paystack_email_token,
    provider, status, current_period_end, provider_payload
  ) values (
    v_user_id, p_email, p_subscription_code, p_customer_code, p_email_token,
    'paystack', p_status, p_period_end, p_provider_payload
  )
  on conflict (paystack_subscription_code) where paystack_subscription_code is not null
  do update set
    user_id = coalesce(excluded.user_id, public.subscriptions.user_id),
    status = excluded.status,
    current_period_end = excluded.current_period_end,
    paystack_customer_code = coalesce(excluded.paystack_customer_code, public.subscriptions.paystack_customer_code),
    paystack_email_token = coalesce(excluded.paystack_email_token, public.subscriptions.paystack_email_token),
    provider_payload = excluded.provider_payload,
    updated_at = now()
  returning id into v_subscription_id;

  insert into public.entitlements (user_id, email, kind, status, subscription_id, expires_at)
  values (
    v_user_id, p_email, 'library',
    case when p_status = 'active' then 'active'::public.entitlement_status else 'inactive'::public.entitlement_status end,
    v_subscription_id, p_period_end
  )
  on conflict (email, kind) where kind = 'library'
  do update set
    user_id = coalesce(excluded.user_id, public.entitlements.user_id),
    status = excluded.status,
    subscription_id = excluded.subscription_id,
    expires_at = excluded.expires_at,
    updated_at = now();

  return v_subscription_id;
end;
$$;

-- 7. Lock the RPCs to service_role only (webhooks/server), mirroring the PayPal functions.
revoke all on function public.paystack_reserve_course_order(uuid, text, uuid, text, integer, text, jsonb) from public, anon, authenticated;
revoke all on function public.paystack_confirm_course_payment(text, jsonb) from public, anon, authenticated;
revoke all on function public.paystack_sync_library_subscription(text, text, text, text, public.subscription_status, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.paystack_reserve_course_order(uuid, text, uuid, text, integer, text, jsonb) to service_role;
grant execute on function public.paystack_confirm_course_payment(text, jsonb) to service_role;
grant execute on function public.paystack_sync_library_subscription(text, text, text, text, public.subscription_status, timestamptz, jsonb) to service_role;
