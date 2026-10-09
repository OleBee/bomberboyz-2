-- Super BomberBoyz – felles toppliste på Supabase (gratisnivå).
-- Lim inn hele filen i Supabase → SQL Editor → Run. Deretter: url + publishable/anon key i bbx-config.js.
-- Nettleseren får bare lese topplisten og kalle submit_round(); tabellene kan ikke skrives direkte.

create table if not exists public.bb_players (
  name_key  text primary key,                 -- navnet i små bokstaver
  name      text not null check (char_length(name) between 1 and 12),
  wins      int  not null default 0,
  games     int  not null default 0,
  kills     int  not null default 0,
  updated_at timestamptz not null default now()
);
create table if not exists public.bb_rounds (
  id        bigint generated always as identity primary key,
  room      text not null,
  round     int  not null,
  ip        text,
  players   jsonb not null,
  created_at timestamptz not null default now(),
  unique (room, round)                        -- samme runde kan ikke sendes inn to ganger
);
create index if not exists bb_rounds_ip_time on public.bb_rounds (ip, created_at);
create index if not exists bb_rounds_room_time on public.bb_rounds (room, created_at);

alter table public.bb_players enable row level security;
alter table public.bb_rounds  enable row level security;
-- Ingen policies = ingen direkte lesing/skriving fra nettleseren. Alt går via view og funksjon under.
revoke all on public.bb_players, public.bb_rounds from anon, authenticated;

create or replace view public.leaderboard_top
with (security_invoker = false) as
  select name, wins, games, kills from public.bb_players
  where games >= 3                            -- må ha spilt minst tre runder for å komme på listen
  order by wins desc, (wins::float / greatest(games, 1)) desc, kills desc
  limit 100;
grant select on public.leaderboard_top to anon;

create or replace function public.submit_round(p_room text, p_round int, p_players jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_ip text := coalesce(split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1), 'ukjent');
  v_n int := jsonb_array_length(p_players);
  v_winners int;
  v_kills int;
  p jsonb;
  v_name text;
begin
  -- formkrav
  if p_room !~ '^[A-Z0-9]{4,8}$' or p_round < 1 or p_round > 1000 then raise exception 'ugyldig rom/runde'; end if;
  if v_n < 2 or v_n > 8 then raise exception 'to til åtte spillere'; end if;
  select count(*) filter (where (x->>'win')::boolean), coalesce(sum((x->>'kills')::int), 0)
    into v_winners, v_kills from jsonb_array_elements(p_players) x;
  if v_winners > 1 or v_kills > v_n - 1 then raise exception 'umulig resultat'; end if;
  if (select count(distinct lower(trim(x->>'name'))) from jsonb_array_elements(p_players) x) <> v_n then raise exception 'like navn'; end if;
  -- fartsgrenser: en runde varer minst ~15 s
  if exists (select 1 from bb_rounds where room = p_room and created_at > now() - interval '15 seconds') then raise exception 'for raskt'; end if;
  if (select count(*) from bb_rounds where ip = v_ip and created_at > now() - interval '10 minutes') >= 30 then raise exception 'for mange runder'; end if;
  if (select count(*) from bb_rounds where created_at > now() - interval '1 minute') >= 120 then raise exception 'travelt'; end if;

  insert into bb_rounds (room, round, ip, players) values (p_room, p_round, v_ip, p_players);   -- feiler ved duplikat
  for p in select * from jsonb_array_elements(p_players) loop
    v_name := left(regexp_replace(trim(p->>'name'), '[[:cntrl:]]', '', 'g'), 12);
    if v_name = '' or v_name ~* '^(spiller( ?[0-9]+)?|robo-.*)$' then continue; end if;   -- standardnavn og boter telles ikke
    insert into bb_players as t (name_key, name, wins, games, kills)
      values (lower(v_name), v_name, case when (p->>'win')::boolean then 1 else 0 end, 1, least(greatest((p->>'kills')::int, 0), 7))
    on conflict (name_key) do update set
      name = excluded.name, wins = t.wins + excluded.wins, games = t.games + 1,
      kills = t.kills + excluded.kills, updated_at = now();
  end loop;
end $$;
revoke all on function public.submit_round(text, int, jsonb) from public;
grant execute on function public.submit_round(text, int, jsonb) to anon;

-- Rydding (valgfritt, kjør av og til): slett rundelogg eldre enn 30 dager.
-- delete from public.bb_rounds where created_at < now() - interval '30 days';
