-- Attendee details and a customer-facing reference for each course booking.
-- Written only by the server (service_role) when checkout starts; read by the owner or admin.
create table if not exists public.course_bookings (
  payment_id uuid primary key references public.payments(id) on delete restrict,
  reference text not null unique check (reference ~ '^AL-[A-HJ-NP-Z2-9]{6}$'),
  user_id uuid references auth.users(id) on delete set null,
  course_session_id uuid not null references public.course_sessions(id) on delete restrict,
  full_name text not null check (length(full_name) between 2 and 100),
  email extensions.citext not null check (length(email) <= 254),
  phone text not null check (length(phone) between 6 and 30),
  company text check (company is null or length(company) <= 120),
  goal text check (goal is null or length(goal) <= 1000),
  confirmation_sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists course_bookings_user_id_idx on public.course_bookings (user_id);
create index if not exists course_bookings_course_session_id_idx on public.course_bookings (course_session_id);

alter table public.course_bookings enable row level security;
grant select on public.course_bookings to authenticated;

create policy "Users and admin read course bookings"
  on public.course_bookings for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or lower(coalesce((select auth.jwt())->>'email', '')) = 'gogomatadi@gmail.com'
  );

-- A cancelled membership keeps access until the end of the period already paid for.
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
    current_period_end = coalesce(excluded.current_period_end, public.subscriptions.current_period_end),
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
    status = case
      when p_status = 'active' then 'active'::public.entitlement_status
      when p_status = 'cancelled'
        and coalesce(p_period_end, public.entitlements.expires_at) > now() then 'active'::public.entitlement_status
      else 'inactive'::public.entitlement_status
    end,
    subscription_id = excluded.subscription_id,
    expires_at = coalesce(excluded.expires_at, public.entitlements.expires_at),
    updated_at = now();

  return v_subscription_id;
end;
$$;

revoke all on function public.paystack_sync_library_subscription(text, text, text, text, public.subscription_status, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.paystack_sync_library_subscription(text, text, text, text, public.subscription_status, timestamptz, jsonb) to service_role;
