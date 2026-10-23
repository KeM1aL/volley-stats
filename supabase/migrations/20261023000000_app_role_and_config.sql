-- Backward compatible: adds a defaulted column and a new table; older apps never write `role`.
alter table public.profiles add column if not exists role text not null default 'user';
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('user', 'admin'));

create or replace function public.protect_profile_role() returns trigger
language plpgsql set search_path = '' as $$
declare caller_role text := coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '');
begin
  -- Requests from the app (anon/authenticated) may not set or change the role; SQL in the dashboard,
  -- the service role and the sign-up trigger (no JWT claims) may.
  if caller_role in ('anon', 'authenticated') then
    if tg_op = 'INSERT' and new.role <> 'user' then
      raise exception 'role_not_allowed' using errcode = '42501';
    elsif tg_op = 'UPDATE' and new.role is distinct from old.role then
      raise exception 'role_not_allowed' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role before insert or update on public.profiles
  for each row execute function public.protect_profile_role();

create table if not exists public.app_config (
  platform text primary key check (platform in ('ios', 'android')),
  min_version text not null default '0.0.0' check (min_version ~ '^\d+(\.\d+)*$'),
  latest_version text not null default '0.0.0' check (latest_version ~ '^\d+(\.\d+)*$'),
  store_url text,
  updated_at timestamptz not null default now()
);
alter table public.app_config enable row level security;
drop policy if exists "app_config readable by everyone" on public.app_config;
create policy "app_config readable by everyone" on public.app_config for select to anon, authenticated using (true);
grant select on public.app_config to anon, authenticated;
insert into public.app_config (platform) values ('ios'), ('android') on conflict (platform) do nothing;
