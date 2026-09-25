-- Allow anonymous visitors to discover only public, non-personal promotions.
drop policy if exists "public visitors can read public promotions" on public.commerce_promotions;
create policy "public visitors can read public promotions"
  on public.commerce_promotions for select
  to anon, authenticated
  using (
    is_active = true
    and status in ('scheduled', 'active')
    and starts_at <= timezone('utc', now())
    and (ends_at is null or ends_at > timezone('utc', now()))
    and audience_type in ('all', 'new_user', 'repeat_customer')
  );

grant select on public.commerce_promotions to anon;