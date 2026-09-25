-- Keep the auth email available to authorized customer-management views without duplicating auth users.
alter table public.customer_profiles add column if not exists email text;
update public.customer_profiles profile
set email = auth_user.email
from auth.users auth_user
where auth_user.id = profile.id and (profile.email is null or profile.email = '');
create index if not exists customer_profiles_email_idx on public.customer_profiles (lower(email));
