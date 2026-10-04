-- Let the storefront use each signed-in user's Supabase session on Vercel.
-- Administrator authorization is based on the verified Auth JWT email claim,
-- never user-editable metadata.

create policy "Storefront admin reads all course sessions"
  on public.course_sessions for select
  to authenticated
  using (lower(coalesce(auth.jwt()->>'email', '')) = 'gogomatadi@gmail.com');

create policy "Storefront admin creates course sessions"
  on public.course_sessions for insert
  to authenticated
  with check (lower(coalesce(auth.jwt()->>'email', '')) = 'gogomatadi@gmail.com');

create policy "Storefront admin updates course sessions"
  on public.course_sessions for update
  to authenticated
  using (lower(coalesce(auth.jwt()->>'email', '')) = 'gogomatadi@gmail.com')
  with check (lower(coalesce(auth.jwt()->>'email', '')) = 'gogomatadi@gmail.com');

create policy "Storefront admin reads all payments"
  on public.payments for select
  to authenticated
  using (lower(coalesce(auth.jwt()->>'email', '')) = 'gogomatadi@gmail.com');

create policy "Storefront admin reads all registrations"
  on public.registrations for select
  to authenticated
  using (lower(coalesce(auth.jwt()->>'email', '')) = 'gogomatadi@gmail.com');

create policy "Storefront admin reads all subscriptions"
  on public.subscriptions for select
  to authenticated
  using (lower(coalesce(auth.jwt()->>'email', '')) = 'gogomatadi@gmail.com');

create policy "Storefront admin reads all entitlements"
  on public.entitlements for select
  to authenticated
  using (lower(coalesce(auth.jwt()->>'email', '')) = 'gogomatadi@gmail.com');

create policy "Storefront admin reads all releases"
  on public.releases for select
  to authenticated
  using (lower(coalesce(auth.jwt()->>'email', '')) = 'gogomatadi@gmail.com');

create policy "Storefront admin creates releases"
  on public.releases for insert
  to authenticated
  with check (lower(coalesce(auth.jwt()->>'email', '')) = 'gogomatadi@gmail.com');

create policy "Storefront admin updates releases"
  on public.releases for update
  to authenticated
  using (lower(coalesce(auth.jwt()->>'email', '')) = 'gogomatadi@gmail.com')
  with check (lower(coalesce(auth.jwt()->>'email', '')) = 'gogomatadi@gmail.com');

create policy "Storefront admin reads webhook events"
  on public.paypal_webhook_events for select
  to authenticated
  using (lower(coalesce(auth.jwt()->>'email', '')) = 'gogomatadi@gmail.com');

create policy "Storefront admin reads site settings"
  on public.site_settings for select
  to authenticated
  using (lower(coalesce(auth.jwt()->>'email', '')) = 'gogomatadi@gmail.com');

create policy "Storefront admin reads release objects"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'blueprint-releases'
    and lower(coalesce(auth.jwt()->>'email', '')) = 'gogomatadi@gmail.com'
  );

create policy "Storefront admin uploads release objects"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'blueprint-releases'
    and lower(coalesce(auth.jwt()->>'email', '')) = 'gogomatadi@gmail.com'
  );

create policy "Storefront admin updates release objects"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'blueprint-releases'
    and lower(coalesce(auth.jwt()->>'email', '')) = 'gogomatadi@gmail.com'
  )
  with check (
    bucket_id = 'blueprint-releases'
    and lower(coalesce(auth.jwt()->>'email', '')) = 'gogomatadi@gmail.com'
  );

create policy "Active members read release objects"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'blueprint-releases'
    and exists (
      select 1
      from public.entitlements entitlement
      where entitlement.user_id = (select auth.uid())
        and entitlement.kind = 'library'
        and entitlement.status = 'active'
        and (entitlement.expires_at is null or entitlement.expires_at > now())
    )
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
  if lower(coalesce(auth.jwt()->>'email', '')) <> 'gogomatadi@gmail.com' then
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

revoke all on function public.publish_release(integer, text, integer, text, text, bigint)
  from public, anon;
grant execute on function public.publish_release(integer, text, integer, text, text, bigint)
  to authenticated, service_role;

grant select, insert, update on public.course_sessions to authenticated;
grant select, insert, update on public.releases to authenticated;
