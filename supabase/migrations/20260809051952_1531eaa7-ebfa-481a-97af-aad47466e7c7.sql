REVOKE EXECUTE ON FUNCTION public.check_rate_limit(uuid, text, integer) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_rate_limits() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.check_rate_limit(uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_old_rate_limits() TO service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;