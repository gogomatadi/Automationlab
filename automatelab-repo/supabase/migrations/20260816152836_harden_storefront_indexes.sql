-- Security hardening and query indexes applied after the initial schema.
create index payments_user_id_idx on public.payments (user_id);
create index payments_course_session_id_idx on public.payments (course_session_id);
create index registrations_user_id_idx on public.registrations (user_id);
create index subscriptions_user_id_idx on public.subscriptions (user_id);
create index entitlements_user_id_idx on public.entitlements (user_id);
create index entitlements_payment_id_idx on public.entitlements (payment_id);
create index entitlements_subscription_id_idx on public.entitlements (subscription_id);
create index entitlements_course_session_id_idx on public.entitlements (course_session_id);

create policy "Client access to webhook events is denied"
  on public.paypal_webhook_events for all
  to anon, authenticated
  using (false)
  with check (false);

create policy "Client access to site settings is denied"
  on public.site_settings for all
  to anon, authenticated
  using (false)
  with check (false);
