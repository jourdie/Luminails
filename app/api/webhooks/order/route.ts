import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { sendOrderNotification, type OrderWebhookRecord } from '../../../../lib/whatsapp';

export const runtime = 'nodejs';

type SupabaseWebhookPayload = { type?: string; table?: string; schema?: string; record?: OrderWebhookRecord | null };

function matchesSecret(expected: string | undefined, received: string | null) {
  if (!expected || !received) return false;
  const expectedBytes = Buffer.from(expected);
  const receivedBytes = Buffer.from(received);
  return expectedBytes.length === receivedBytes.length && timingSafeEqual(expectedBytes, receivedBytes);
}

export async function POST(request: Request) {
  if (!matchesSecret(process.env.WHATSAPP_WEBHOOK_SECRET, request.headers.get('x-whatsapp-webhook-secret'))) return NextResponse.json({ ok: false, message: 'Webhook tidak terautorisasi.' }, { status: 401 });
  let payload: SupabaseWebhookPayload;
  try { payload = await request.json() as SupabaseWebhookPayload; } catch { return NextResponse.json({ ok: false, message: 'Payload JSON tidak valid.' }, { status: 400 }); }
  if (payload.type !== 'INSERT' || payload.table !== 'commerce_orders' || payload.schema !== 'public' || !payload.record?.id) return NextResponse.json({ ok: true, skipped: true, message: 'Event diabaikan.' });
  const result = await sendOrderNotification(payload.record);
  return NextResponse.json(result, { status: result.ok || result.skipped ? 200 : 502 });
}
