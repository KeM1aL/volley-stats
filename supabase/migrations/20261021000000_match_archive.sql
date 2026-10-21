-- Archive matches and delete unstarted ones. matches.archived_at (null = not archived) hides a match from lists and
-- statistics until restored; delete_unstarted_match really deletes a match that never started.
-- Backward compatible: a nullable column and a new function. Applied by the user in the dashboard on 2026-10-21.

-- Match archive: archived matches leave lists and statistics and can be restored (archived_at null = not archived).
-- Not in the RxDB schema: devices never push it, so a device can't undo an archive.
alter table public.matches add column if not exists archived_at timestamptz null;

-- Real delete of a match that never started (status 'upcoming'), with any leftover rows of an undone set.
-- SECURITY INVOKER: the caller's RLS applies (the creator of either team may delete the match and its rows).
-- sets, score_points and player_stats reference matches without ON DELETE CASCADE; events cascade.
create or replace function public.delete_unstarted_match(match_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  match_status text;
  deleted_count integer;
begin
  -- FOR UPDATE: a start in another session waits, and a started match is refused below.
  select m.status::text into match_status
  from public.matches m
  where m.id = delete_unstarted_match.match_id
  for update;

  if not found then
    -- Readable by anyone, but not lockable: the caller may not change this match.
    if exists (select 1 from public.matches m where m.id = delete_unstarted_match.match_id) then
      raise exception 'match_not_deleted' using errcode = '42501';
    end if;
    raise exception 'match_not_found' using errcode = 'P0002';
  end if;

  if match_status <> 'upcoming' then
    raise exception 'match_started' using errcode = 'P0001';
  end if;

  delete from public.player_stats ps where ps.match_id = delete_unstarted_match.match_id;
  delete from public.score_points sp where sp.match_id = delete_unstarted_match.match_id;
  delete from public.sets s where s.match_id = delete_unstarted_match.match_id;
  delete from public.matches m where m.id = delete_unstarted_match.match_id;
  get diagnostics deleted_count = row_count;
  if deleted_count = 0 then
    raise exception 'match_not_deleted' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.delete_unstarted_match(uuid) from public, anon;
grant execute on function public.delete_unstarted_match(uuid) to authenticated;
