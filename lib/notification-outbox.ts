import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { sendWhatsAppText, sendWhatsAppTextTo } from './whatsapp';

type NotificationOutboxRow = {
  id: string;
  recipient_key: string;
  payload: Record<string, unknown> | null;
};

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createSupabaseClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function processWhatsAppNotificationOutbox(limit = 25) {
  const supabase = createServiceClient();
  if (!supabase) return { ok: false as const, message: 'Supabase service role belum dikonfigurasi.' };

  const { data, error } = await (supabase as any).rpc('claim_notification_outbox_for_channel', {
    p_channel: 'whatsapp',
    p_limit: limit,
  });
  if (error) return { ok: false as const, message: error.message };

  let sent = 0;
  let failed = 0;
  for (const row of (data ?? []) as NotificationOutboxRow[]) {
    const payload = row.payload ?? {};
    const customerPhone = typeof payload.contact_phone === 'string' ? payload.contact_phone : '';
    const result = row.recipient_key === 'customer'
      ? await sendWhatsAppTextTo(customerPhone, formatOutboxMessage(payload))
      : await sendWhatsAppText(formatOutboxMessage(payload));

    if (result.ok) {
      await (supabase as any).rpc('complete_notification_outbox', {
        p_id: row.id,
        p_provider_message_id: result.providerMessageId ?? null,
      });
      sent += 1;
    } else {
      await (supabase as any).rpc('fail_notification_outbox', {
        p_id: row.id,
        p_error: result.message,
        p_retry_after_seconds: result.skipped ? 900 : 300,
      });
      failed += 1;
    }
  }

  return { ok: true as const, claimed: (data ?? []).length, sent, failed };
}

function formatOutboxMessage(payload: Record<string, unknown>) {
  const eventType = typeof payload.event_type === 'string' ? payload.event_type : 'order_update';
  const orderId = typeof payload.order_id === 'string' ? payload.order_id : '-';
  const total = Number(payload.total_idr ?? 0);
  const totalLabel = 'Rp' + new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(total);
  return [
    eventType === 'order_created' ? 'Order baru Luminails' : 'Update order Luminails',
    'Nomor order: ' + orderId,
    'Total: ' + totalLabel,
    'Status order: ' + String(payload.status ?? '-'),
    'Pembayaran: ' + String(payload.payment_status ?? '-'),
    'Fulfillment: ' + String(payload.fulfillment_status ?? '-'),
  ].join('\n');
}
