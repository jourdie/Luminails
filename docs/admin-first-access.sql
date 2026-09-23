-- Run this once in Supabase Dashboard > SQL Editor after signing in with Google.
-- Replace the email with the exact Google email used for the staff account.
insert into public.admin_memberships (user_id, role, is_active)
select id, 'owner', true
from auth.users
where lower(email) = lower('YOUR_GOOGLE_EMAIL@example.com')
on conflict (user_id) do update
set role = 'owner', is_active = true;

-- Optional verification:
select membership.user_id, users.email, membership.role, membership.is_active
from public.admin_memberships membership
join auth.users users on users.id = membership.user_id
where lower(users.email) = lower('YOUR_GOOGLE_EMAIL@example.com');
