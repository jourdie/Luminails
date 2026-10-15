import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createMidtransSnapTransaction, isUuid } from '../../../../lib/payments/midtrans';
import { createClient } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return createSupabaseAdmin(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return errorResponse('Sesi login sudah berakhir. Silakan masuk lagi.', 401);

  let orderId = '';
  try {
    const body = await request.json() as { order_id?: unknown };
    orderId = typeof body.order_id === 'string' ? body.order_id.trim() : '';
  } catch {
    return errorResponse('Permintaan pembayaran tidak valid.', 400);
  }
  if (!isUuid(orderId)) return errorResponse('Order tidak ditemukan.', 400);

  const { data: order, error: orderError } = await (supabase.from('commerce_orders') as any)
    .select('id, customer_id, status, payment_status, total_idr, payment_provider, payment_token, payment_redirect_url, payment_expires_at')
    .eq('id', orderId)
    .eq('customer_id', authData.user.id)
    .maybeSingle();
  if (orderError) return errorResponse('Order belum dapat dimuat. Coba lagi sebentar.', 500);
  if (!order) return errorResponse('Order tidak ditemukan.', 404);
  if (order.payment_status === 'paid') return errorResponse('Order ini sudah dibayar.', 409);
  if (order.payment_status !== 'pending' || !['submitted_for_review', 'awaiting_payment'].includes(order.status)) {
    return errorResponse('Order ini sudah tidak bisa dibayar online. Cek status terbaru di riwayat order.', 409);
  }

  if (order.payment_provider === 'midtrans' && order.payment_token && order.payment_redirect_url) {
    return NextResponse.json({
      ok: true,
      redirect_url: order.payment_redirect_url,
      expires_at: order.payment_expires_at,
      reused: true,
    });
  }

  const admin = createAdminClient();
  if (!admin) return errorResponse('Pembayaran online belum dikonfigurasi. Hubungi Luminails.', 503);

  let snap: { token: string; redirect_url: string };
  try {
    snap = await createMidtransSnapTransaction({ orderId: order.id, grossAmount: Number(order.total_idr) });
  } catch (error) {
    const code = error instanceof Error ? error.message.split(':')[0] : '';
    if (code === 'MIDTRANS_NOT_CONFIGURED') return errorResponse('Pembayaran online belum aktif. Hubungi Luminails untuk melanjutkan order.', 503);
    return errorResponse('Halaman pembayaran belum siap. Coba lagi dalam beberapa saat.', 502);
  }

  const paymentStartedAt = new Date().toISOString();
  const paymentExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { data: saved, error: saveError } = await (admin.from('commerce_orders') as any)
    .update({
      payment_provider: 'midtrans',
      payment_token: snap.token,
      payment_redirect_url: snap.redirect_url,
      payment_started_at: paymentStartedAt,
      payment_expires_at: paymentExpiresAt,
    })
    .eq('id', order.id)
    .eq('customer_id', authData.user.id)
    .eq('payment_status', 'pending')
    .is('payment_token', null)
    .select('payment_redirect_url, payment_expires_at')
    .maybeSingle();

  if (saveError) return errorResponse('Pembayaran berhasil disiapkan, tetapi order belum dapat disimpan. Coba buka ulang halaman ini.', 500);

  if (saved?.payment_redirect_url) {
    return NextResponse.json({ ok: true, redirect_url: saved.payment_redirect_url, expires_at: saved.payment_expires_at, reused: false });
  }

  // Another request may have won the write race. Reuse its persisted attempt.
  const { data: existing } = await (admin.from('commerce_orders') as any)
    .select('payment_token, payment_redirect_url, payment_expires_at')
    .eq('id', order.id)
    .eq('customer_id', authData.user.id)
    .maybeSingle();
  if (existing?.payment_token && existing.payment_redirect_url) {
    return NextResponse.json({ ok: true, redirect_url: existing.payment_redirect_url, expires_at: existing.payment_expires_at, reused: true });
  }

  return NextResponse.json({ ok: true, redirect_url: snap.redirect_url, expires_at: paymentExpiresAt, reused: false });
}
