import { createHash, timingSafeEqual } from 'node:crypto';

export type MidtransNotification = Record<string, unknown> & {
  order_id?: unknown;
  status_code?: unknown;
  gross_amount?: unknown;
  signature_key?: unknown;
  transaction_id?: unknown;
  transaction_status?: unknown;
  fraud_status?: unknown;
  status_message?: unknown;
};

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'expired' | 'refunded' | 'partially_refunded';

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export function midtransSignatureInput(notification: MidtransNotification, serverKey: string) {
  return `${text(notification.order_id)}${text(notification.status_code)}${text(notification.gross_amount)}${serverKey}`;
}

export function verifyMidtransSignature(notification: MidtransNotification, serverKey: string) {
  const received = text(notification.signature_key).toLowerCase();
  if (!serverKey || !received || !text(notification.order_id) || !text(notification.status_code) || !text(notification.gross_amount)) return false;

  const expected = createHash('sha512').update(midtransSignatureInput(notification, serverKey), 'utf8').digest('hex');
  const expectedBytes = Buffer.from(expected, 'utf8');
  const receivedBytes = Buffer.from(received, 'utf8');
  return expectedBytes.length === receivedBytes.length && timingSafeEqual(expectedBytes, receivedBytes);
}

export function parseMidtransGrossAmount(value: unknown) {
  const amount = text(value);
  if (!/^(?:0|[1-9]\d*)(?:\.00)?$/.test(amount)) return null;
  const normalized = amount.endsWith('.00') ? amount.slice(0, -3) : amount;
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function midtransProviderEventId(notification: MidtransNotification) {
  const transactionId = text(notification.transaction_id);
  const transactionStatus = text(notification.transaction_status).toLowerCase();
  const statusCode = text(notification.status_code);
  return transactionId && transactionStatus && statusCode ? `${transactionId}:${transactionStatus}:${statusCode}` : '';
}

export function mapMidtransPaymentStatus(notification: MidtransNotification): PaymentStatus | null {
  const transactionStatus = text(notification.transaction_status).toLowerCase();
  const fraudStatus = text(notification.fraud_status).toLowerCase();

  if (fraudStatus === 'deny') return 'failed';
  if (transactionStatus === 'settlement' || transactionStatus === 'capture') {
    return fraudStatus && fraudStatus !== 'accept' ? 'pending' : 'paid';
  }
  if (transactionStatus === 'pending' || transactionStatus === 'authorize') return 'pending';
  if (transactionStatus === 'expire') return 'expired';
  if (transactionStatus === 'cancel' || transactionStatus === 'deny') return 'failed';
  if (transactionStatus === 'refund') return 'refunded';
  if (transactionStatus === 'partial_refund') return 'partially_refunded';
  return null;
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
