import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { processWhatsAppNotificationOutbox } from '../../../../lib/notification-outbox';

export const runtime = 'nodejs';

function matchesSecret(expected: string | undefined, received: string | null) {
  if (!expected || !received) return false;
  const expectedBytes = Buffer.from(expected);
  const receivedBytes = Buffer.from(received);
  return expectedBytes.length === receivedBytes.length && timingSafeEqual(expectedBytes, receivedBytes);
}

export async function POST(request: Request) {
  if (!matchesSecret(process.env.INTERNAL_NOTIFICATION_WORKER_SECRET, request.headers.get('x-notification-worker-secret'))) {
    return NextResponse.json({ ok: false, message: 'Worker tidak terautorisasi.' }, { status: 401 });
  }

  const limitValue = new URL(request.url).searchParams.get('limit');
  const limit = Math.min(100, Math.max(1, Number.parseInt(limitValue ?? '25', 10) || 25));
  const result = await processWhatsAppNotificationOutbox(limit);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
