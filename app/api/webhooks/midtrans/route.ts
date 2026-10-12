import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import {
  isUuid,
  mapMidtransPaymentStatus,
  midtransProviderEventId,
  parseMidtransGrossAmount,
  verifyMidtransSignature,
  type MidtransNotification,
} from '../../../../lib/payments/midtrans';

export const runtime = 'nodejs';

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return createSupabaseAdmin(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function POST(request: Request) {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) return NextResponse.json({ ok: false, message: 'Payment provider belum dikonfigurasi.' }, { status: 503 });

  let payload: MidtransNotification;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid payload');
    payload = parsed as MidtransNotification;
  } catch {
    return NextResponse.json({ ok: false, message: 'Payload payment tidak valid.' }, { status: 400 });
  }

  if (!verifyMidtransSignature(payload, serverKey)) {
    return NextResponse.json({ ok: false, message: 'Signature payment tidak valid.' }, { status: 401 });
  }

  const orderId = typeof payload.order_id === 'string' ? payload.order_id.trim() : '';
  const transactionId = typeof payload.transaction_id === 'string' ? payload.transaction_id.trim() : '';
  const providerEventId = midtransProviderEventId(payload);
  const paymentStatus = mapMidtransPaymentStatus(payload);
  const amountIdr = parseMidtransGrossAmount(payload.gross_amount);
  if (!isUuid(orderId) || !transactionId || !providerEventId || !paymentStatus || amountIdr === null) {
    return NextResponse.json({ ok: false, message: 'Data payment tidak lengkap atau tidak didukung.' }, { status: 422 });
  }

  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ ok: false, message: 'Database payment belum dikonfigurasi.' }, { status: 503 });

  const { data, error } = await (supabase as any).rpc('apply_payment_event', {
    p_provider: 'midtrans',
    p_provider_event_id: providerEventId,
    p_order_id: orderId,
    p_payment_status: paymentStatus,
    p_payment_reference: transactionId,
    p_amount_idr: amountIdr,
    p_failure_reason: paymentStatus === 'failed' ? String(payload.status_message ?? 'Payment ditolak') : null,
    p_payload: payload,
  });

  if (error) {
    const message = String(error.message ?? 'Payment event gagal diproses.');
    const status = /ORDER_NOT_FOUND|PAYMENT_AMOUNT_MISMATCH|PAYMENT_REFERENCE_REUSED|PAYMENT_EVENT_ORDER_MISMATCH/.test(message) ? 422 : 500;
    return NextResponse.json({ ok: false, message: 'Payment event gagal diproses.' }, { status });
  }

  const result = (data ?? {}) as { duplicate?: boolean; order_id?: string; payment_status?: string };
  return NextResponse.json({
    ok: true,
    duplicate: result.duplicate === true,
    order_id: result.order_id ?? orderId,
    payment_status: result.payment_status ?? paymentStatus,
  });
}
