alter table public.customer_profiles
  add column if not exists avatar_url text,
  add column if not exists phone text,
  add column if not exists address text,
  add column if not exists studio_type text,
  add column if not exists additional_info text;

comment on column public.customer_profiles.address is 'Customer delivery and domicile address; editable at checkout/profile.';
comment on column public.customer_profiles.studio_type is 'Business context such as offline salon or home studio.';
comment on column public.customer_profiles.additional_info is 'Optional customer notes for B2B account context.';

grant select, insert, update on public.customer_profiles to authenticated;
