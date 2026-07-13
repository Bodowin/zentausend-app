-- Applied after the legacy public clique code was detected and invalidated.
-- Only one-way hashes are stored here; plaintext codes are never committed.

alter table private.games_backup_20260713
  add primary key (id);

update private.app_config
set value = case key
  when 'clique_code' then '853fe5dc112d1ee3968bce6137b9ce977b2e3bd8d661a5a504ac4603c12c0f8d'
  when 'admin_code' then '02a6088ab374dc595fbb32bee0148cd909dad31d9bf281e60599edcded4309e9'
  else value
end
where key in ('clique_code', 'admin_code');
