create table public.storefront_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now(),
  check (length(key) between 1 and 100),
  check (length(value) between 1 and 1000)
);

alter table public.storefront_settings enable row level security;

grant select, insert, update on public.storefront_settings to authenticated;

create policy "Storefront admin reads settings"
  on public.storefront_settings for select
  to authenticated
  using (lower(coalesce((select auth.jwt())->>'email', '')) = 'gogomatadi@gmail.com');

create policy "Storefront admin creates settings"
  on public.storefront_settings for insert
  to authenticated
  with check (lower(coalesce((select auth.jwt())->>'email', '')) = 'gogomatadi@gmail.com');

create policy "Storefront admin updates settings"
  on public.storefront_settings for update
  to authenticated
  using (lower(coalesce((select auth.jwt())->>'email', '')) = 'gogomatadi@gmail.com')
  with check (lower(coalesce((select auth.jwt())->>'email', '')) = 'gogomatadi@gmail.com');
