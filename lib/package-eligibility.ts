export type PackageEligibilityRule = {
  customerTierId: string | null;
  customerId: string | null;
  brandId: string | null;
  skuId: string | null;
  minimumQuantity: number;
  minimumOrderValueIdr: number;
};

export type PackageEligibilityContext = {
  customerId?: string | null;
  customerTierId?: string | null;
  brandId: string;
  selectedQuantity?: number;
  selectedSkuIds?: string[];
  orderValueIdr?: number;
};

export function isPackageEligible(rules: PackageEligibilityRule[], context: PackageEligibilityContext) {
  if (!rules.length) return true;
  return rules.every((rule) => {
    const customerMatch = !rule.customerId || rule.customerId === context.customerId;
    const tierMatch = !rule.customerTierId || rule.customerTierId === context.customerTierId;
    const brandMatch = !rule.brandId || rule.brandId === context.brandId;
    const skuMatch = !rule.skuId || Boolean(context.selectedSkuIds?.includes(rule.skuId));
    return customerMatch && tierMatch && brandMatch && skuMatch
      && (context.selectedQuantity ?? 1) >= rule.minimumQuantity
      && (context.orderValueIdr ?? 0) >= rule.minimumOrderValueIdr;
  });
}

export type CustomerSelectedBenefit = { id: string; quantity: number; allowedSkuIds: string[] };
export type PackageBenefitSelection = { benefitId: string; skuId: string; quantity: number };

export function validatePackageBenefitSelections(benefits: CustomerSelectedBenefit[], selections: PackageBenefitSelection[]) {
  for (const benefit of benefits) {
    const rows = selections.filter((selection) => selection.benefitId === benefit.id);
    if (!rows.length) return { ok: false as const, code: 'PACKAGE_BENEFIT_SELECTION_REQUIRED' };
    if (rows.some((row) => !Number.isInteger(row.quantity) || row.quantity < 1 || !benefit.allowedSkuIds.includes(row.skuId))) return { ok: false as const, code: 'PACKAGE_BENEFIT_SKU_NOT_ALLOWED' };
    if (rows.reduce((total, row) => total + row.quantity, 0) !== benefit.quantity) return { ok: false as const, code: 'PACKAGE_BENEFIT_QUANTITY' };
  }
  if (selections.some((selection) => !benefits.some((benefit) => benefit.id === selection.benefitId))) return { ok: false as const, code: 'INVALID_PACKAGE_BENEFIT_SELECTION' };
  return { ok: true as const };
}
