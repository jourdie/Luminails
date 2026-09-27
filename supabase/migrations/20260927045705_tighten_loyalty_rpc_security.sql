-- Tighten RPC execution grants identified by Supabase advisors.
-- Point expiry is an internal/admin operation and has no customer-facing caller.
revoke all on function public.expire_loyalty_points(timestamptz) from public, anon, authenticated;
grant execute on function public.expire_loyalty_points(timestamptz) to service_role;

-- Trigger functions in private must use an explicit search path when they execute.
alter function private.normalize_loyalty_reversal() set search_path = public, private, pg_temp;
