drop policy if exists "admins can manage promotions" on public.commerce_promotions;
drop policy if exists "admins can manage promotion sku targets" on public.promotion_skus;
drop policy if exists "admins can manage promotion category targets" on public.promotion_categories;
drop policy if exists "admins can manage promotion tier targets" on public.promotion_pricing_tiers;
drop policy if exists "admins can manage eligible promotion customers" on public.promotion_eligible_customers;
drop policy if exists "admins can manage bundle items" on public.promotion_bundle_items;
drop policy if exists "admins can read promotion redemptions" on public.promotion_redemptions;

create policy "admins can manage promotions"
  on public.commerce_promotions for all
  to authenticated
  using (public.has_admin_permission('promotions'))
  with check (public.has_admin_permission('promotions'));

create policy "admins can manage promotion sku targets"
  on public.promotion_skus for all
  to authenticated
  using (public.has_admin_permission('promotions'))
  with check (public.has_admin_permission('promotions'));

create policy "admins can manage promotion category targets"
  on public.promotion_categories for all
  to authenticated
  using (public.has_admin_permission('promotions'))
  with check (public.has_admin_permission('promotions'));

create policy "admins can manage promotion tier targets"
  on public.promotion_pricing_tiers for all
  to authenticated
  using (public.has_admin_permission('promotions'))
  with check (public.has_admin_permission('promotions'));

create policy "admins can manage eligible promotion customers"
  on public.promotion_eligible_customers for all
  to authenticated
  using (public.has_admin_permission('promotions'))
  with check (public.has_admin_permission('promotions'));

create policy "admins can manage bundle items"
  on public.promotion_bundle_items for all
  to authenticated
  using (public.has_admin_permission('promotions'))
  with check (public.has_admin_permission('promotions'));

create policy "admins can read promotion redemptions"
  on public.promotion_redemptions for select
  to authenticated
  using (public.has_admin_permission('promotions'));
