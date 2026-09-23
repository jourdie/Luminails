import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';

export const dynamic = 'force-dynamic';

const fallback = {
  phone: '6289501086888',
  message: 'Halo Luminails, saya mau konsultasi package dan order.',
};

export async function GET() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return NextResponse.json(fallback, { headers: { 'Cache-Control': 'public, max-age=60' } });
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from('commerce_store_settings')
    .select('value')
    .eq('key', 'whatsapp')
    .maybeSingle();

  const value = data?.value as { phone?: string; message?: string } | null;
  return NextResponse.json(
    { phone: value?.phone || fallback.phone, message: value?.message || fallback.message },
    { headers: { 'Cache-Control': 'public, max-age=60' } },
  );
}
