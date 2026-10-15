-- Account deletion (stores require it in-app). Deleting a user removes the person (auth user, profile,
-- memberships). Each team the user created is handed over to a member with an account or soft-deleted,
-- as the user chose. Spec: docs/superpowers/specs/2026-10-14-static-export-readiness-design.md §5.
-- Audit: docs/superpowers/notes/2026-10-15-user-fk-audit.md.

alter table public.clubs alter column user_id drop not null;
alter table public.clubs drop constraint clubs_user_id_fkey,
  add constraint clubs_user_id_fkey foreign key (user_id) references auth.users (id) on delete set null;

alter table public.championships alter column user_id drop not null;
alter table public.championships drop constraint championships_user_id_fkey,
  add constraint championships_user_id_fkey foreign key (user_id) references auth.users (id) on delete set null;

-- Reached only by teams soft-deleted below or before: every live team is handed over first.
alter table public.teams drop constraint teams_user_id_fkey,
  add constraint teams_user_id_fkey foreign key (user_id) references auth.users (id) on delete set null;

-- The leaving user's own player rows stay, unlinked.
alter table public.team_members drop constraint team_members_user_id_fkey,
  add constraint team_members_user_id_fkey foreign key (user_id) references auth.users (id) on delete set null;

-- profiles.id and club_members.user_id already cascade; matches.scorer_user_id already sets null.

create or replace function public.delete_my_account(decisions jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  created uuid[];
  decided uuid[];
  decision jsonb;
  target_team uuid;
  new_owner uuid;
begin
  if caller is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if decisions is null or jsonb_typeof(decisions) <> 'array' then
    raise exception 'invalid_decisions' using errcode = 'P0001';
  end if;

  -- Exactly one decision for each live team the caller created, and none for other teams.
  select coalesce(array_agg(t.id order by t.id), '{}') into created
  from public.teams t where t.user_id = caller and t._deleted = false;
  select coalesce(array_agg((e ->> 'team_id')::uuid order by (e ->> 'team_id')::uuid), '{}') into decided
  from jsonb_array_elements(decisions) e;
  if decided is distinct from created then
    raise exception 'invalid_decisions' using errcode = 'P0001';
  end if;

  for decision in select * from jsonb_array_elements(decisions) loop
    target_team := (decision ->> 'team_id')::uuid;
    if decision ->> 'action' = 'transfer' then
      new_owner := (decision ->> 'new_owner')::uuid;
      -- An eligible member: linked account, not archived, not deleted, not the caller.
      if new_owner is null or new_owner = caller or not exists (
        select 1 from public.team_members m
        where m.team_id = target_team and m.user_id = new_owner and m.archived_at is null and m._deleted = false
      ) then
        raise exception 'invalid_new_owner' using errcode = 'P0001', detail = target_team::text;
      end if;
      update public.teams set user_id = new_owner where id = target_team;
      update public.team_members set role = 'owner'
      where team_id = target_team and user_id = new_owner and archived_at is null and _deleted = false;
    elsif decision ->> 'action' = 'delete' then
      -- Soft delete, like the rest of the app. The matches stay: each also belongs to the opponent's history.
      update public.teams set _deleted = true where id = target_team;
      update public.team_members set _deleted = true where team_id = target_team;
    else
      raise exception 'invalid_decisions' using errcode = 'P0001';
    end if;
  end loop;

  delete from auth.users where id = caller;
end;
$$;

revoke execute on function public.delete_my_account(jsonb) from public, anon;
grant execute on function public.delete_my_account(jsonb) to authenticated;
