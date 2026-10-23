-- Backward compatible: replaces protect_profile_role() so an empty request.jwt.claims setting reads as no claims.
create or replace function public.protect_profile_role() returns trigger
language plpgsql set search_path = '' as $$
declare caller_role text := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '');
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
