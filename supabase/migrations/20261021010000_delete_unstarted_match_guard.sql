-- Guard for delete_unstarted_match. Backward compatible: replaces the function body only (same signature and grants).
-- To be applied by the user in the dashboard.

-- delete_unstarted_match: also refuse a match that has a set (not soft-deleted), whatever its status says.
-- An importer re-run could reset a played match to 'upcoming'; a played match is never deleted, only archived.
-- Children are deleted leaf first (events, score_points, player_stats, sets), so no foreign key between them can block.
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

  if match_status <> 'upcoming'
     or exists (select 1 from public.sets s where s.match_id = delete_unstarted_match.match_id and s._deleted = false) then
    raise exception 'match_started' using errcode = 'P0001';
  end if;

  delete from public.events e where e.match_id = delete_unstarted_match.match_id;
  delete from public.score_points sp where sp.match_id = delete_unstarted_match.match_id;
  delete from public.player_stats ps where ps.match_id = delete_unstarted_match.match_id;
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
