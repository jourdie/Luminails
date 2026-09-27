import assert from 'node:assert/strict';
import { selectActivePackagePrice } from '../lib/packages.ts';
import { calculateBasePoints, calculateEarnedPoints, calculateRefundReversalPoints, consumePointLots, eligibleSpend, hasPackageConflict, isManualTierOverrideActive, pointsToNextTier, rewardCostRatio, selectCustomerTier, summarizeExpiringPointLots } from '../lib/loyalty-engine.ts';
import { isPackageEligible, validatePackageBenefitSelections } from '../lib/package-eligibility.ts';

assert.equal(eligibleSpend(1_280_000, 80_000), 1_200_000);
assert.equal(calculateBasePoints(1_299_999), 129);
assert.equal(calculateEarnedPoints(1_299_999, 0, 1.2), 154);
assert.equal(rewardCostRatio(500, 10_000, 88_000, 1), 1.76);
assert.equal(Number(rewardCostRatio(500, 10_000, 88_000, 1.2).toFixed(3)), 2.112);
assert.equal(calculateEarnedPoints(5_000_000, 0, 1), 500);
assert.equal(calculateEarnedPoints(5_000_000, 0, 1.2), 600);
assert.equal(calculateEarnedPoints(5_000_000, 0, 1.5), 750);
assert.equal(calculateEarnedPoints(1_320_000, 0, 1.5), 198);
assert.equal(calculateRefundReversalPoints(198, 1_320_000, 660_000), 99);
assert.equal(calculateRefundReversalPoints(100, 1_000_000, 2_000_000), 100);
assert.equal(-100 + 250, 150);
assert.deepEqual(summarizeExpiringPointLots([
  { remainingPoints: 100, expiresAt: '2026-10-01T00:00:00.000Z' },
  { remainingPoints: 50, expiresAt: '2026-10-20T00:00:00.000Z' },
  { remainingPoints: 99, expiresAt: '2026-09-20T00:00:00.000Z' },
], Date.parse('2026-09-25T00:00:00.000Z'), 30), {
  points: 150,
  nextExpiryAt: '2026-10-01T00:00:00.000Z',
});
assert.deepEqual(consumePointLots([
  { id: 'old', remainingPoints: 80, expiresAt: '2026-10-01T00:00:00.000Z' },
  { id: 'new', remainingPoints: 100, expiresAt: '2027-01-01T00:00:00.000Z' },
], 120), {
  lots: [
    { id: 'old', remainingPoints: 0, expiresAt: '2026-10-01T00:00:00.000Z' },
    { id: 'new', remainingPoints: 60, expiresAt: '2027-01-01T00:00:00.000Z' },
  ],
  consumed: [{ id: 'old', points: 80 }, { id: 'new', points: 40 }],
  shortfall: 0,
});
assert.equal(isManualTierOverrideActive(true, '2026-10-01T00:00:00.000Z', Date.parse('2026-09-25T00:00:00.000Z')), true);
assert.equal(isManualTierOverrideActive(true, '2026-09-01T00:00:00.000Z', Date.parse('2026-09-25T00:00:00.000Z')), false);
assert.equal(hasPackageConflict([{ id: 'a', stackable: false }, { id: 'b', stackable: true }]), true);
assert.equal(hasPackageConflict([{ id: 'a', stackable: true }, { id: 'b', stackable: true }]), false);
assert.equal(selectActivePackagePrice([
  { packageId: 'package-1', unitPriceIdr: 1_200_000, effectiveFrom: '2026-09-01T00:00:00.000Z', effectiveUntil: null },
  { packageId: 'package-1', unitPriceIdr: 1_000_000, effectiveFrom: '2026-10-01T00:00:00.000Z', effectiveUntil: null },
], 'package-1', new Date('2026-09-27T00:00:00.000Z'))?.unitPriceIdr, 1_200_000);
assert.equal(selectActivePackagePrice([
  { packageId: 'package-1', unitPriceIdr: 900_000, effectiveFrom: '2026-08-01T00:00:00.000Z', effectiveUntil: '2026-09-15T00:00:00.000Z' },
], 'package-1', new Date('2026-09-27T00:00:00.000Z')), null);

const tiers = [
  { id: 'basic', code: 'BASIC', name: 'Basic', minimumRollingSpendIdr: 0, maximumRollingSpendIdr: 1_999_999, rollingPeriodMonths: 6, pointMultiplier: 1, priority: 10, isActive: true },
  { id: 'vip1', code: 'VIP_1', name: 'VIP 1', minimumRollingSpendIdr: 2_000_000, maximumRollingSpendIdr: 4_999_999, rollingPeriodMonths: 6, pointMultiplier: 1.2, priority: 20, isActive: true },
  { id: 'vip2', code: 'VIP_2', name: 'VIP 2', minimumRollingSpendIdr: 5_000_000, maximumRollingSpendIdr: null, rollingPeriodMonths: 6, pointMultiplier: 1.5, priority: 30, isActive: true },
];
assert.equal(selectCustomerTier(2_000_000, tiers)?.code, 'VIP_1');
assert.equal(selectCustomerTier(2_000_000, [
  { ...tiers[1], id: 'overlap-low', code: 'OVERLAP_LOW', maximumRollingSpendIdr: null, priority: 10 },
  { ...tiers[1], id: 'overlap-high', code: 'OVERLAP_HIGH', maximumRollingSpendIdr: null, priority: 20 },
])?.code, 'OVERLAP_HIGH');
assert.equal(pointsToNextTier(2_500_000, tiers)?.remainingSpendIdr, 2_500_000);
assert.equal(isPackageEligible([{ customerTierId: 'vip1', customerId: null, brandId: 'party', skuId: null, minimumQuantity: 1, minimumOrderValueIdr: 0 }], { customerTierId: 'vip1', brandId: 'party' }), true);
assert.equal(isPackageEligible([{ customerTierId: 'vip1', customerId: null, brandId: 'party', skuId: null, minimumQuantity: 1, minimumOrderValueIdr: 0 }], { customerTierId: 'basic', brandId: 'party' }), false);
assert.equal(isPackageEligible([{ customerTierId: 'vip1', customerId: null, brandId: 'party', skuId: 'sku-1', minimumQuantity: 2, minimumOrderValueIdr: 1_000_000 }], { customerTierId: 'vip1', brandId: 'party', selectedSkuIds: ['sku-1'], selectedQuantity: 2, orderValueIdr: 1_000_000 }), true);
assert.equal(isPackageEligible([
  { customerTierId: 'vip1', customerId: null, brandId: 'party', skuId: null, minimumQuantity: 1, minimumOrderValueIdr: 0 },
  { customerTierId: null, customerId: null, brandId: 'party', skuId: 'sku-2', minimumQuantity: 1, minimumOrderValueIdr: 0 },
], { customerTierId: 'vip1', brandId: 'party', selectedSkuIds: ['sku-1'] }), false);
const benefitRule = [{ id: 'benefit-tools', quantity: 2, allowedSkuIds: ['buffer', 'pusher'] }];
assert.deepEqual(validatePackageBenefitSelections(benefitRule, [{ benefitId: 'benefit-tools', skuId: 'buffer', quantity: 1 }, { benefitId: 'benefit-tools', skuId: 'pusher', quantity: 1 }]), { ok: true });
assert.equal(validatePackageBenefitSelections(benefitRule, [{ benefitId: 'benefit-tools', skuId: 'buffer', quantity: 1 }]).code, 'PACKAGE_BENEFIT_QUANTITY');
assert.equal(validatePackageBenefitSelections(benefitRule, [{ benefitId: 'benefit-tools', skuId: 'unknown', quantity: 2 }]).code, 'PACKAGE_BENEFIT_SKU_NOT_ALLOWED');
console.log('loyalty-engine tests passed');
