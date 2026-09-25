export type CustomerTierRule = {
  id: string;
  code: string;
  name: string;
  minimumRollingSpendIdr: number;
  maximumRollingSpendIdr: number | null;
  rollingPeriodMonths: number;
  pointMultiplier: number;
  priority: number;
  isActive: boolean;
};

export function eligibleSpend(subtotalIdr: number, discountIdr: number) {
  return Math.max(0, Math.trunc(subtotalIdr) - Math.trunc(discountIdr));
}

export function calculateBasePoints(spendIdr: number, pointUnitValueIdr = 10_000) {
  return Math.floor(Math.max(0, spendIdr) / Math.max(1, pointUnitValueIdr));
}

export function calculateEarnedPoints(spendIdr: number, discountIdr: number, tierMultiplier = 1, pointUnitValueIdr = 10_000) {
  return Math.floor(calculateBasePoints(eligibleSpend(spendIdr, discountIdr), pointUnitValueIdr) * Math.max(0, tierMultiplier));
}

export function selectCustomerTier(spendIdr: number, tiers: CustomerTierRule[]) {
  return tiers.filter((tier) => tier.isActive && tier.minimumRollingSpendIdr <= spendIdr && (tier.maximumRollingSpendIdr === null || spendIdr <= tier.maximumRollingSpendIdr)).sort((a, b) => b.minimumRollingSpendIdr - a.minimumRollingSpendIdr)[0] ?? null;
}

export function pointsToNextTier(spendIdr: number, tiers: CustomerTierRule[]) {
  const next = tiers.filter((tier) => tier.isActive && tier.minimumRollingSpendIdr > spendIdr).sort((a, b) => a.minimumRollingSpendIdr - b.minimumRollingSpendIdr)[0] ?? null;
  return next ? { tier: next, remainingSpendIdr: Math.max(0, next.minimumRollingSpendIdr - spendIdr) } : null;
}

export function rewardCostRatio(pointsCost: number, pointUnitValueIdr: number, hppIdr: number, tierMultiplier = 1) {
  if (hppIdr <= 0 || pointsCost <= 0) return 0;
  const eligibleSpendRequired = (pointsCost * Math.max(1, pointUnitValueIdr)) / Math.max(0.01, tierMultiplier);
  return (hppIdr / eligibleSpendRequired) * 100;
}

export function calculateRefundReversalPoints(issuedPoints: number, eligibleSpendIdr: number, refundedEligibleIdr: number) {
  if (issuedPoints <= 0 || eligibleSpendIdr <= 0 || refundedEligibleIdr <= 0) return 0;
  return Math.min(issuedPoints, Math.floor(issuedPoints * Math.min(eligibleSpendIdr, refundedEligibleIdr) / eligibleSpendIdr));
}

export type PointLot = { id: string; remainingPoints: number; expiresAt: string };

export function consumePointLots(lots: PointLot[], pointsToConsume: number) {
  let remaining = Math.max(0, Math.trunc(pointsToConsume));
  const consumed: Array<{ id: string; points: number }> = [];
  const nextLots = [...lots].sort((a, b) => a.expiresAt.localeCompare(b.expiresAt)).map((lot) => ({ ...lot }));
  for (const lot of nextLots) {
    if (remaining <= 0) break;
    const amount = Math.min(lot.remainingPoints, remaining);
    lot.remainingPoints -= amount;
    remaining -= amount;
    if (amount > 0) consumed.push({ id: lot.id, points: amount });
  }
  return { lots: nextLots, consumed, shortfall: remaining };
}

export function isManualTierOverrideActive(enabled: boolean, expiresAt: string | null | undefined, now = Date.now()) {
  if (!enabled) return false;
  if (!expiresAt) return true;
  const expiry = new Date(expiresAt).getTime();
  return Number.isFinite(expiry) && expiry > now;
}

export type PackageStackRule = { id: string; stackable: boolean };

export function hasPackageConflict(packages: PackageStackRule[]) {
  return packages.length > 1 && packages.some((item) => !item.stackable);
}
