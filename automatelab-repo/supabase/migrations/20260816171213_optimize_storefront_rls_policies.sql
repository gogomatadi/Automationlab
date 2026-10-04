-- Consolidate permissive read policies and evaluate verified Auth claims once per query.

drop policy if exists "Published course sessions are public" on public.course_sessions;
drop policy if exists "Storefront admin reads all course sessions" on public.course_sessions;
create policy "Public reads published course sessions"
  on public.course_sessions for select
  to anon
  using (status = 'published' and (registration_deadline is null or registration_deadline > now()));
create policy "Authenticated users read allowed course sessions"
  on public.course_sessions for select
  to authenticated
  using (
    (status = 'published' and (registration_deadline is null or registration_deadline > now()))
    or lower(coalesce((select auth.jwt())->>'email', '')) = 'gogomatadi@gmail.com'
  );

drop policy if exists "Storefront admin creates course sessions" on public.course_sessions;
create policy "Storefront admin creates course sessions"
  on public.course_sessions for insert
  to authenticated
  with check (lower(coalesce((select auth.jwt())->>'email', '')) = 'gogomatadi@gmail.com');

drop policy if exists "Storefront admin updates course sessions" on public.course_sessions;
create policy "Storefront admin updates course sessions"
  on public.course_sessions for update
  to authenticated
  using (lower(coalesce((select auth.jwt())->>'email', '')) = 'gogomatadi@gmail.com')
  with check (lower(coalesce((select auth.jwt())->>'email', '')) = 'gogomatadi@gmail.com');

drop policy if exists "Users read their own payments" on public.payments;
drop policy if exists "Storefront admin reads all payments" on public.payments;
create policy "Users and admin read allowed payments"
  on public.payments for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or lower(coalesce((select auth.jwt())->>'email', '')) = 'gogomatadi@gmail.com'
  );

drop policy if exists "Users read their own registrations" on public.registrations;
drop policy if exists "Storefront admin reads all registrations" on public.registrations;
create policy "Users and admin read allowed registrations"
  on public.registrations for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or lower(coalesce((select auth.jwt())->>'email', '')) = 'gogomatadi@gmail.com'
  );

drop policy if exists "Users read their own subscriptions" on public.subscriptions;
drop policy if exists "Storefront admin reads all subscriptions" on public.subscriptions;
create policy "Users and admin read allowed subscriptions"
  on public.subscriptions for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or lower(coalesce((select auth.jwt())->>'email', '')) = 'gogomatadi@gmail.com'
  );

drop policy if exists "Users read their own entitlements" on public.entitlements;
drop policy if exists "Storefront admin reads all entitlements" on public.entitlements;
create policy "Users and admin read allowed entitlements"
  on public.entitlements for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or lower(coalesce((select auth.jwt())->>'email', '')) = 'gogomatadi@gmail.com'
  );

drop policy if exists "Authenticated users read published releases" on public.releases;
drop policy if exists "Storefront admin reads all releases" on public.releases;
create policy "Authenticated users read allowed releases"
  on public.releases for select
  to authenticated
  using (
    published_at is not null
    or lower(coalesce((select auth.jwt())->>'email', '')) = 'gogomatadi@gmail.com'
  );

drop policy if exists "Storefront admin creates releases" on public.releases;
create policy "Storefront admin creates releases"
  on public.releases for insert
  to authenticated
  with check (lower(coalesce((select auth.jwt())->>'email', '')) = 'gogomatadi@gmail.com');

drop policy if exists "Storefront admin updates releases" on public.releases;
create policy "Storefront admin updates releases"
  on public.releases for update
  to authenticated
  using (lower(coalesce((select auth.jwt())->>'email', '')) = 'gogomatadi@gmail.com')
  with check (lower(coalesce((select auth.jwt())->>'email', '')) = 'gogomatadi@gmail.com');

drop policy if exists "Client access to webhook events is denied" on public.paypal_webhook_events;
drop policy if exists "Storefront admin reads webhook events" on public.paypal_webhook_events;
create policy "Storefront admin reads webhook events"
  on public.paypal_webhook_events for select
  to authenticated
  using (lower(coalesce((select auth.jwt())->>'email', '')) = 'gogomatadi@gmail.com');

drop policy if exists "Client access to site settings is denied" on public.site_settings;
drop policy if exists "Storefront admin reads site settings" on public.site_settings;
create policy "Storefront admin reads site settings"
  on public.site_settings for select
  to authenticated
  using (lower(coalesce((select auth.jwt())->>'email', '')) = 'gogomatadi@gmail.com');

drop policy if exists "Storefront admin reads release objects" on storage.objects;
drop policy if exists "Active members read release objects" on storage.objects;
create policy "Authorized users read release objects"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'blueprint-releases'
    and (
      lower(coalesce((select auth.jwt())->>'email', '')) = 'gogomatadi@gmail.com'
      or exists (
        select 1
        from public.entitlements entitlement
        where entitlement.user_id = (select auth.uid())
          and entitlement.kind = 'library'
          and entitlement.status = 'active'
          and (entitlement.expires_at is null or entitlement.expires_at > now())
      )
    )
  );

drop policy if exists "Storefront admin uploads release objects" on storage.objects;
create policy "Storefront admin uploads release objects"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'blueprint-releases'
    and lower(coalesce((select auth.jwt())->>'email', '')) = 'gogomatadi@gmail.com'
  );

drop policy if exists "Storefront admin updates release objects" on storage.objects;
create policy "Storefront admin updates release objects"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'blueprint-releases'
    and lower(coalesce((select auth.jwt())->>'email', '')) = 'gogomatadi@gmail.com'
  )
  with check (
    bucket_id = 'blueprint-releases'
    and lower(coalesce((select auth.jwt())->>'email', '')) = 'gogomatadi@gmail.com'
  );

create or replace function public.publish_release(
  p_version integer,
  p_title text,
  p_blueprint_count integer,
  p_storage_path text,
  p_file_name text,
  p_file_size_bytes bigint
) returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_release_id uuid;
begin
  if lower(coalesce((select auth.jwt())->>'email', '')) <> 'gogomatadi@gmail.com' then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

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
