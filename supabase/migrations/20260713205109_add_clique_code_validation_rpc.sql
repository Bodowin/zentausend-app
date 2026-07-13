-- Read-only validity probe for the client. It reveals neither the code nor its
-- stored hash and lets the UI distinguish a rotated code from a network error.

create function public.check_clique_code()
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, private
as $$
  select private.clique_code_ok();
$$;

revoke all on function public.check_clique_code() from public;
grant execute on function public.check_clique_code() to anon, authenticated, service_role;

notify pgrst, 'reload schema';
