import { NextResponse } from 'next/server';
import { needsCustomerProfile } from '../../../lib/account';
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
        const metadata = data.user.user_metadata ?? {};
        const metadataName = metadata.full_name ?? metadata.name ?? metadata.display_name;
        const metadataAvatar = metadata.avatar_url ?? metadata.picture;
        await supabase.from('customer_profiles').upsert({
          id: data.user.id,
          display_name: typeof metadataName === 'string' && metadataName.trim() ? metadataName : data.user.email?.split('@')[0] ?? null,
          avatar_url: typeof metadataAvatar === 'string' ? metadataAvatar : null,
          status: 'approved',
        }, { onConflict: 'id' });
        if (next === '/') {
          const { data: profile } = await supabase.from('customer_profiles').select('display_name, business_name, phone, address, studio_type').eq('id', data.user.id).maybeSingle();
          if (needsCustomerProfile(profile)) return NextResponse.redirect(new URL('/account/profile?setup=1', url.origin));
        }
      }
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
