import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  mapMidtransPaymentStatus,
  midtransProviderEventId,
  parseMidtransGrossAmount,
  verifyMidtransSignature,
} from '../lib/payments/midtrans.ts';

const notification = {
  order_id: 'd2719f31-7b74-4f01-9d8e-5a0d78d44f03',
  status_code: '200',
  gross_amount: '125000.00',
  transaction_id: 'midtrans-transaction-1',
  transaction_status: 'settlement',
  fraud_status: 'accept',
  signature_key: '',
};
const serverKey = 'sandbox-server-key';
notification.signature_key = createHash('sha512')
  .update(`${notification.order_id}${notification.status_code}${notification.gross_amount}${serverKey}`)
  .digest('hex');

assert.equal(verifyMidtransSignature(notification, serverKey), true);
assert.equal(verifyMidtransSignature({ ...notification, gross_amount: '125001.00' }, serverKey), false);
assert.equal(mapMidtransPaymentStatus(notification), 'paid');
assert.equal(midtransProviderEventId(notification), 'midtrans-transaction-1:settlement:200');
assert.equal(mapMidtransPaymentStatus({ ...notification, transaction_status: 'expire' }), 'expired');
assert.equal(mapMidtransPaymentStatus({ ...notification, transaction_status: 'capture', fraud_status: 'challenge' }), 'pending');
assert.equal(parseMidtransGrossAmount('125000.00'), 125000);
assert.equal(parseMidtransGrossAmount('125000.50'), null);

console.log('midtrans webhook tests passed');
