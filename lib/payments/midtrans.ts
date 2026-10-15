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

export type MidtransSnapTransaction = {
  token: string;
  redirect_url: string;
};

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

export async function createMidtransSnapTransaction(input: { orderId: string; grossAmount: number }) {
  const serverKey = process.env.MIDTRANS_SERVER_KEY?.trim();
  if (!serverKey) throw new Error('MIDTRANS_NOT_CONFIGURED');
  if (!Number.isSafeInteger(input.grossAmount) || input.grossAmount < 0) throw new Error('MIDTRANS_INVALID_AMOUNT');

  const environment = process.env.MIDTRANS_ENVIRONMENT?.trim().toLowerCase() === 'production' ? 'production' : 'sandbox';
  const endpoint = environment === 'production'
    ? 'https://app.midtrans.com/snap/v1/transactions'
    : 'https://app.sandbox.midtrans.com/snap/v1/transactions';
  const authorization = Buffer.from(`${serverKey}:`, 'utf8').toString('base64');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Basic ${authorization}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      transaction_details: { order_id: input.orderId, gross_amount: input.grossAmount },
      item_details: [{ id: input.orderId.slice(0, 50), price: input.grossAmount, quantity: 1, name: 'Order Luminails' }],
    }),
    signal: AbortSignal.timeout(12_000),
  });

  const payload = await response.json().catch(() => null) as { token?: unknown; redirect_url?: unknown; error_messages?: unknown } | null;
  if (!response.ok) {
    const providerMessage = Array.isArray(payload?.error_messages) ? payload.error_messages.filter((item): item is string => typeof item === 'string').join(' ') : '';
    throw new Error(`MIDTRANS_CREATE_FAILED${providerMessage ? `:${providerMessage}` : ''}`);
  }

  const token = typeof payload?.token === 'string' ? payload.token.trim() : '';
  const redirectUrl = typeof payload?.redirect_url === 'string' ? payload.redirect_url.trim() : '';
  if (!token || !redirectUrl) throw new Error('MIDTRANS_RESPONSE_INCOMPLETE');
  return { token, redirect_url: redirectUrl } satisfies MidtransSnapTransaction;
}
