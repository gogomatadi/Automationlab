-- Initial storefront schema.
create extension if not exists citext with schema extensions;

create type public.course_status as enum ('draft', 'published', 'closed', 'cancelled');
create type public.payment_status as enum ('created', 'approved', 'paid', 'failed', 'refunded', 'cancelled');
create type public.subscription_status as enum ('pending', 'active', 'past_due', 'suspended', 'cancelled', 'expired');
create type public.entitlement_status as enum ('active', 'inactive', 'revoked');

create table public.course_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Build Your First AI Workflow',
  starts_at timestamptz not null,
  timezone text not null default 'Africa/Johannesburg',
  duration_minutes integer not null default 180 check (duration_minutes between 30 and 1440),
  capacity integer not null default 20 check (capacity > 0),
  price_cents integer not null default 2900 check (price_cents > 0),
  currency text not null default 'USD' check (char_length(currency) = 3),
  status public.course_status not null default 'draft',
  registration_deadline timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email extensions.citext not null,
  product_type text not null check (product_type in ('course', 'library_subscription')),
  course_session_id uuid references public.course_sessions(id) on delete restrict,
  paypal_order_id text unique,
  paypal_capture_id text unique,
  paypal_subscription_id text unique,
  amount_cents integer,
  currency text not null default 'USD',
  status public.payment_status not null default 'created',
  provider_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  course_session_id uuid not null references public.course_sessions(id) on delete restrict,
  payment_id uuid not null unique references public.payments(id) on delete restrict,
  user_id uuid references auth.users(id) on delete set null,
  email extensions.citext not null,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled', 'attended', 'no_show')),
  created_at timestamptz not null default now(),
  unique (course_session_id, email)
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email extensions.citext not null,
  paypal_subscription_id text not null unique,
  status public.subscription_status not null default 'pending',
  current_period_end timestamptz,
  provider_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.releases (
  id uuid primary key default gen_random_uuid(),
  version integer not null unique check (version > 0),
  title text not null,
  blueprint_count integer not null check (blueprint_count > 0),
  storage_path text not null unique,
  file_name text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  is_current boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index releases_one_current_idx on public.releases (is_current) where is_current;

create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email extensions.citext not null,
  kind text not null check (kind in ('library', 'course')),
  status public.entitlement_status not null default 'active',
  payment_id uuid references public.payments(id) on delete restrict,
  subscription_id uuid references public.subscriptions(id) on delete restrict,
  course_session_id uuid references public.course_sessions(id) on delete restrict,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index entitlements_library_email_idx
  on public.entitlements (email, kind)
  where kind = 'library';

create table public.paypal_webhook_events (
  event_id text primary key,
  event_type text not null,
  status text not null default 'received' check (status in ('received', 'processed', 'failed', 'ignored')),
  payload jsonb not null,
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create table public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create or replace function public.reserve_course_order(
  p_user_id uuid,
  p_email text,
  p_course_session_id uuid,
  p_order_id text,
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
  select * into v_session
  from public.course_sessions
  where id = p_course_session_id
  for update;

  if not found or v_session.status <> 'published'
    or (v_session.registration_deadline is not null and v_session.registration_deadline <= now()) then
    raise exception 'Course session is not available';
  end if;

  if p_amount_cents <> v_session.price_cents or p_currency <> v_session.currency then
    raise exception 'Order amount does not match course price';
  end if;

  select
    (select count(*) from public.registrations where course_session_id = v_session.id and status = 'confirmed')
    +
    (select count(*) from public.payments where course_session_id = v_session.id and status in ('created', 'approved') and created_at > now() - interval '30 minutes')
  into v_occupied;

  if v_occupied >= v_session.capacity then
    raise exception 'Course session is full';
  end if;

  insert into public.payments (
    user_id, email, product_type, course_session_id, paypal_order_id,
    amount_cents, currency, provider_payload
  ) values (
    p_user_id, p_email, 'course', p_course_session_id, p_order_id,
    p_amount_cents, p_currency, p_provider_payload
  ) returning id into v_payment_id;

  return v_payment_id;
end;
$$;

create or replace function public.confirm_course_payment(
  p_order_id text,
  p_capture_id text,
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
  select * into v_payment
  from public.payments
  where paypal_order_id = p_order_id
  for update;

  if not found then
    raise exception 'Unknown PayPal order';
  end if;

  if v_payment.product_type <> 'course' or v_payment.course_session_id is null then
    raise exception 'Order is not a course payment';
  end if;

  select id into v_registration_id
  from public.registrations
  where payment_id = v_payment.id;

  if found then
    return v_registration_id;
  end if;

  select * into v_session
  from public.course_sessions
  where id = v_payment.course_session_id
  for update;

  select count(*) into v_registration_count
  from public.registrations
  where course_session_id = v_session.id and status = 'confirmed';

  if v_registration_count >= v_session.capacity then
    raise exception 'Course session is full';
  end if;

  update public.payments
  set status = 'paid',
      paypal_capture_id = coalesce(paypal_capture_id, p_capture_id),
      provider_payload = p_provider_payload,
      updated_at = now()
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

create or replace function public.sync_library_subscription(
  p_subscription_id text,
  p_status public.subscription_status,
  p_period_end timestamptz,
  p_provider_payload jsonb
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_subscription public.subscriptions;
begin
  select * into v_subscription
  from public.subscriptions
  where paypal_subscription_id = p_subscription_id
  for update;

  if not found then
    raise exception 'Unknown PayPal subscription';
  end if;

  update public.subscriptions
  set status = p_status,
      current_period_end = p_period_end,
      provider_payload = p_provider_payload,
      updated_at = now()
  where id = v_subscription.id
  returning * into v_subscription;

  insert into public.entitlements (user_id, email, kind, status, subscription_id, expires_at)
  values (
    v_subscription.user_id,
    v_subscription.email,
    'library',
    case when p_status = 'active' then 'active'::public.entitlement_status else 'inactive'::public.entitlement_status end,
    v_subscription.id,
    p_period_end
  )
  on conflict (email, kind) where kind = 'library'
  do update set
    user_id = excluded.user_id,
    status = excluded.status,
    subscription_id = excluded.subscription_id,
    expires_at = excluded.expires_at,
    updated_at = now();

  return v_subscription.id;
end;
$$;

create or replace function public.publish_release(
  p_version integer,
  p_title text,
  p_blueprint_count integer,
  p_storage_path text,
  p_file_name text,
  p_file_size_bytes bigint
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_release_id uuid;
begin
  perform pg_advisory_xact_lock(814291);
  update public.releases set is_current = false where is_current;
  insert into public.releases (
    version, title, blueprint_count, storage_path, file_name,
    file_size_bytes, is_current, published_at
  ) values (
    p_version, p_title, p_blueprint_count, p_storage_path, p_file_name,
    p_file_size_bytes, true, now()
  ) returning id into v_release_id;
  return v_release_id;
end;
$$;

revoke all on function public.confirm_course_payment(text, text, jsonb) from public, anon, authenticated;
revoke all on function public.sync_library_subscription(text, public.subscription_status, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.confirm_course_payment(text, text, jsonb) to service_role;
grant execute on function public.sync_library_subscription(text, public.subscription_status, timestamptz, jsonb) to service_role;
revoke all on function public.publish_release(integer, text, integer, text, text, bigint) from public, anon, authenticated;
grant execute on function public.publish_release(integer, text, integer, text, text, bigint) to service_role;
revoke all on function public.reserve_course_order(uuid, text, uuid, text, integer, text, jsonb) from public, anon, authenticated;
grant execute on function public.reserve_course_order(uuid, text, uuid, text, integer, text, jsonb) to service_role;

alter table public.course_sessions enable row level security;
alter table public.payments enable row level security;
alter table public.registrations enable row level security;
alter table public.subscriptions enable row level security;
alter table public.releases enable row level security;
alter table public.entitlements enable row level security;
alter table public.paypal_webhook_events enable row level security;
alter table public.site_settings enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.course_sessions to anon, authenticated;
grant select on public.payments, public.registrations, public.subscriptions, public.releases, public.entitlements to authenticated;

create policy "Published course sessions are public"
  on public.course_sessions for select
  to anon, authenticated
  using (status = 'published' and (registration_deadline is null or registration_deadline > now()));

create policy "Users read their own payments"
  on public.payments for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users read their own registrations"
  on public.registrations for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users read their own subscriptions"
  on public.subscriptions for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Authenticated users read published releases"
  on public.releases for select
  to authenticated
  using (published_at is not null);

create policy "Users read their own entitlements"
  on public.entitlements for select
  to authenticated
  using ((select auth.uid()) = user_id);

insert into public.site_settings (key, value) values
  ('storefront', '{"library_price":"9.99","course_price":"29.00","blueprint_count":84}'::jsonb);
