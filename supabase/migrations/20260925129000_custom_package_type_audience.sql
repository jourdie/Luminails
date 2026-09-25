-- Admin-created package types must be valid package audiences too.
-- The package_type_id is the source of truth; audience stores its public slug.
alter table public.commerce_packages
  drop constraint if exists commerce_packages_audience_check;

alter table public.commerce_packages
  add constraint commerce_packages_audience_check
  check (
    audience = lower(audience)
    and audience ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  );

create index if not exists commerce_packages_audience_idx
  on public.commerce_packages (audience, status, sort_order);
