import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const requestedNext = url.searchParams.get('next') || '/';
  const next = requestedNext.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : '/';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        await supabase.from('customer_profiles').upsert({
          id: data.user.id,
          display_name: data.user.email?.split('@')[0] ?? null,
          status: 'approved',
        });
      }
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
