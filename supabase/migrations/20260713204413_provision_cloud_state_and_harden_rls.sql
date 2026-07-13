-- Applied to Supabase project xikqtpqdzmwsvybaklud on 2026-07-13.
-- Existing game rows are preserved in a private server-side snapshot before
-- constraints, grants or policies are changed.

create table private.games_backup_20260713 as table public.games;
revoke all on private.games_backup_20260713 from public, anon, authenticated;

alter table public.games
  add constraint games_client_id_length check (char_length(client_id) between 1 and 100) not valid,
  add constraint games_event_length check (char_length(event) <= 160) not valid,
  add constraint games_winner_length check (char_length(winner) between 1 and 120) not valid,
  add constraint games_score_range check (winner_score between 0 and 100000000) not valid,
  add constraint games_players_shape check (
    case when jsonb_typeof(players) = 'array'
      then jsonb_array_length(players) between 1 and 16
      else false
    end
  ) not valid,
  add constraint games_turns_shape check (
    turns is null or case when jsonb_typeof(turns) = 'array'
      then jsonb_array_length(turns) <= 5000
      else false
    end
  ) not valid;

alter table public.games validate constraint games_client_id_length;
alter table public.games validate constraint games_event_length;
alter table public.games validate constraint games_winner_length;
alter table public.games validate constraint games_score_range;
alter table public.games validate constraint games_players_shape;
alter table public.games validate constraint games_turns_shape;

-- Convert the two existing application codes to one-way hashes in place.
update private.app_config
set value = encode(extensions.digest(value, 'sha256'), 'hex')
where key in ('clique_code', 'admin_code')
  and value !~ '^[0-9a-f]{64}$';

alter table private.app_config
  add constraint app_config_hash_format
  check (key not in ('clique_code', 'admin_code') or value ~ '^[0-9a-f]{64}$') not valid;
alter table private.app_config validate constraint app_config_hash_format;

create or replace function private.clique_code_ok()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, private, extensions
as $$
  select exists (
    select 1
    from private.app_config
    where key = 'clique_code'
      and value = encode(
        extensions.digest(
          coalesce(
            nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-clique-code',
            ''
          ),
          'sha256'
        ),
        'hex'
      )
  );
$$;

create or replace function private.admin_code_ok()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, private, extensions
as $$
  select exists (
    select 1
    from private.app_config
    where key = 'admin_code'
      and value = encode(
        extensions.digest(
          coalesce(
            nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-admin-code',
            ''
          ),
          'sha256'
        ),
        'hex'
      )
  );
$$;

revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;
revoke all on private.app_config from public, anon, authenticated;
revoke all on function private.clique_code_ok() from public;
revoke all on function private.admin_code_ok() from public;
grant execute on function private.clique_code_ok() to anon, authenticated, service_role;
grant execute on function private.admin_code_ok() to anon, authenticated, service_role;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function private.set_updated_at() from public;

-- Remove broad default grants such as TRUNCATE/TRIGGER/REFERENCES.
revoke all on public.games from anon, authenticated;
grant select, insert, update, delete on public.games to anon, authenticated;

drop policy if exists games_delete_admin on public.games;
create policy games_delete_admin
on public.games
for delete
to anon, authenticated
using (private.admin_code_ok());

create policy games_update_clique
on public.games
for update
to anon, authenticated
using (private.clique_code_ok())
with check (private.clique_code_ok());

create table public.clique_state (
  state_key text primary key check (char_length(state_key) between 1 and 80),
  version bigint not null default 1 check (version > 0),
  payload jsonb not null default '{}'::jsonb check (
    jsonb_typeof(payload) = 'object'
    and octet_length(payload::text) <= 262144
  ),
  updated_at timestamptz not null default now()
);

create trigger clique_state_set_updated_at
before update on public.clique_state
for each row execute function private.set_updated_at();

alter table public.clique_state enable row level security;
revoke all on public.clique_state from public, anon, authenticated;
grant select, insert, update, delete on public.clique_state to anon, authenticated;

create policy clique_state_select_public
on public.clique_state
for select
to anon, authenticated
using (true);

create policy clique_state_insert_clique
on public.clique_state
for insert
to anon, authenticated
with check (private.clique_code_ok());

create policy clique_state_update_clique
on public.clique_state
for update
to anon, authenticated
using (private.clique_code_ok())
with check (private.clique_code_ok());

create policy clique_state_delete_admin
on public.clique_state
for delete
to anon, authenticated
using (private.admin_code_ok());

insert into public.clique_state (state_key, version, payload)
values (
  'player_identity',
  1,
  '{"aliases":{},"redirects":{},"preferredNames":{}}'::jsonb
);

notify pgrst, 'reload schema';
