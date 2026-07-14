insert into public.clique_state (state_key, version, payload)
values (
  'active_game',
  1,
  jsonb_build_object(
    'schemaVersion', 1,
    'status', 'cleared',
    'sessionId', '',
    'ownerDeviceId', '',
    'savedAt', '1970-01-01T00:00:00.000Z',
    'game', null
  )
)
on conflict (state_key) do nothing;
