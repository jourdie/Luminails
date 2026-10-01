import assert from 'node:assert/strict';
import { formatCustomerOrderCreatedNotification, formatOrderNotification, formatOrderStatusNotification, sendWhatsAppText, sendWhatsAppTextTo } from '../lib/whatsapp.ts';
import { formatIDR, formatQuantity, selectQuantityPrice, selectActivePackagePrice } from '../lib/packages.ts';
import { calculateEarnedPoints, calculateRefundReversalPoints, recommendRewardPoints, summarizeExpiringPointLots } from '../lib/loyalty-engine.ts';
import { isPackageEligible, validatePackageBenefitSelections } from '../lib/package-eligibility.ts';

assert.equal(formatIDR(1_200_000), 'Rp1.200.000');
assert.equal(formatQuantity(1_234), '1.234');
assert.equal(selectQuantityPrice([
  { packageId: 'p', minimumQuantity: 12, maximumQuantity: 23, unitPriceIdr: 120_000 },
  { packageId: 'p', minimumQuantity: 24, maximumQuantity: null, unitPriceIdr: 117_000 },
], 24), 117_000);
assert.equal(selectQuantityPrice([], 12), null);
assert.equal(selectActivePackagePrice([
  { packageId: 'p', unitPriceIdr: 100_000, effectiveFrom: '2026-01-01T00:00:00Z', effectiveUntil: null },
  { packageId: 'p', unitPriceIdr: 90_000, effectiveFrom: '2026-10-01T00:00:00Z', effectiveUntil: null },
], 'p', new Date('2026-09-30T00:00:00Z'))?.unitPriceIdr, 100_000);

assert.equal(calculateEarnedPoints(1_200_000, 200_000, 1.25), 125);
assert.equal(recommendRewardPoints(88_000, 10_000, 3, 1), 294);
assert.equal(calculateRefundReversalPoints(200, 2_000_000, 500_000), 50);
assert.deepEqual(summarizeExpiringPointLots([
  { remainingPoints: 100, expiresAt: '2026-10-01T00:00:00Z' },
  { remainingPoints: 40, expiresAt: '2026-12-01T00:00:00Z' },
], Date.parse('2026-09-30T00:00:00Z'), 30), {
  points: 100,
  nextExpiryAt: '2026-10-01T00:00:00Z',
});

assert.equal(isPackageEligible([], { brandId: 'brand-a' }), true);
assert.equal(isPackageEligible([
  { customerTierId: 'VIP', customerId: null, brandId: 'brand-a', skuId: null, minimumQuantity: 2, minimumOrderValueIdr: 1_000_000 },
], { customerTierId: 'VIP', brandId: 'brand-a', selectedQuantity: 2, orderValueIdr: 1_000_000 }), true);
assert.equal(isPackageEligible([
  { customerTierId: 'VIP', customerId: null, brandId: 'brand-a', skuId: null, minimumQuantity: 2, minimumOrderValueIdr: 1_000_000 },
], { customerTierId: 'BASIC', brandId: 'brand-a', selectedQuantity: 2, orderValueIdr: 1_000_000 }), false);
assert.deepEqual(validatePackageBenefitSelections(
  [{ id: 'benefit', quantity: 1, allowedSkuIds: ['sku-a'] }],
  [],
), { ok: false, code: 'PACKAGE_BENEFIT_SELECTION_REQUIRED' });
assert.deepEqual(validatePackageBenefitSelections(
  [{ id: 'benefit', quantity: 1, allowedSkuIds: ['sku-a'] }],
  [
    { benefitId: 'benefit', skuId: 'sku-a', quantity: 1 },
    { benefitId: 'unknown', skuId: 'sku-a', quantity: 1 },
  ],
), { ok: false, code: 'INVALID_PACKAGE_BENEFIT_SELECTION' });

const order = {
  id: 'order-1',
  source_channel: 'web',
  total_idr: 1_200_000,
  status: 'submitted_for_review',
  payment_status: 'pending',
  fulfillment_status: 'unallocated',
};
const orderMessage = formatOrderNotification(order, [{
  sku_snapshot: 'SKU-001',
  product_name_snapshot: 'Base Coat',
  quantity: 2,
  unit_price_idr: 100_000,
  line_total_idr: 200_000,
}]);
assert.match(orderMessage, /Order: order-1/);
assert.match(orderMessage, /Rp1\.200\.000/);
assert.match(orderMessage, /Base Coat/);
assert.match(formatCustomerOrderCreatedNotification('order-1', 1_200_000, 'WELCOME'), /WELCOME/);
assert.match(formatOrderStatusNotification(order, { provider_code: 'paxel', tracking_number: 'PX-1' }), /PX-1/);

const previousEnvironment = {
  token: process.env.WHATSAPP_CLOUD_API_TOKEN,
  phoneId: process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID,
  adminTo: process.env.WHATSAPP_ADMIN_TO,
};
delete process.env.WHATSAPP_CLOUD_API_TOKEN;
delete process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID;
delete process.env.WHATSAPP_ADMIN_TO;
const skippedCustomer = await sendWhatsAppTextTo('628123456789', 'test');
const skippedAdmin = await sendWhatsAppText('test');
assert.equal(skippedCustomer.ok, false);
assert.equal(skippedCustomer.skipped, true);
assert.equal(skippedAdmin.ok, false);
assert.equal(skippedAdmin.skipped, true);
if (previousEnvironment.token === undefined) delete process.env.WHATSAPP_CLOUD_API_TOKEN; else process.env.WHATSAPP_CLOUD_API_TOKEN = previousEnvironment.token;
if (previousEnvironment.phoneId === undefined) delete process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID; else process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID = previousEnvironment.phoneId;
if (previousEnvironment.adminTo === undefined) delete process.env.WHATSAPP_ADMIN_TO; else process.env.WHATSAPP_ADMIN_TO = previousEnvironment.adminTo;

console.log('commerce domain tests passed');
