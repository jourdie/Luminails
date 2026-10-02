import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { processWhatsAppNotificationOutbox } from '../../../../lib/notification-outbox';

export const runtime = 'nodejs';

type SupabaseWebhookPayload = { type?: string; table?: string; schema?: string; record?: { id?: string } | null };

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
  try {
    // Keep webhook CPU bounded. Retries or a scheduled worker can drain the
    // remaining queue without making one request exceed the Worker limit.
    const result = await processWhatsAppNotificationOutbox(5);
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch {
    return NextResponse.json({ ok: false, message: 'Notifikasi order gagal diproses dan akan dicoba ulang.' }, { status: 502 });
  }
}
