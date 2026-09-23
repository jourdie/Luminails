'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { createClient } from '../lib/supabase/client';

export function AuthForm({ supabaseUrl, supabasePublishableKey }: { supabaseUrl: string; supabasePublishableKey: string }) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);

  async function handleGoogleLogin() {
    setPending(true);
    setMessage('');

    if (!supabaseUrl || !supabasePublishableKey) {
      setMessage('Supabase belum dikonfigurasi di Cloudflare Variables and Secrets.');
      setPending(false);
      return;
    }

    const supabase = createClient(supabaseUrl, supabasePublishableKey);
    const next = new URLSearchParams(window.location.search).get('next') || '/';
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) {
      setMessage(error.message);
      setPending(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage('');

    if (!supabaseUrl || !supabasePublishableKey) {
      setMessage('Supabase belum dikonfigurasi di Cloudflare Variables and Secrets.');
      setPending(false);
      return;
    }

    const supabase = createClient(supabaseUrl, supabasePublishableKey);
    const next = new URLSearchParams(window.location.search).get('next') || '/';
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    setMessage(error ? error.message : 'Link login sudah dikirim. Cek inbox email Anda.');
    setPending(false);
  }

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <Link className="brand" href="/">luminails<span className="brand-dot">.</span></Link>
        <p className="eyebrow auth-eyebrow">Luminails / account</p>
        <h1>Masuk ke ruang<br /><em>order kamu.</em></h1>
        <p className="auth-copy">User biasa mulai dari harga standard. Setelah akun dan order memenuhi threshold, tier Premium B2B akan aktif sesuai aturan yang dikonfigurasi admin.</p>
        <button className="button button-outline button-full auth-google-button" type="button" onClick={handleGoogleLogin} disabled={pending}><span className="google-mark">G</span>{pending ? 'Menghubungkan...' : 'Lanjut dengan Google'} <span>&rarr;</span></button>
        <div className="auth-divider"><span>atau gunakan email</span></div>
        <form onSubmit={handleSubmit} className="auth-form">
          <label htmlFor="email">Email kerja atau email studio</label>
          <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nama@studio.com" required />
          <button className="button button-dark button-full" type="submit" disabled={pending}>{pending ? 'Mengirim link...' : 'Kirim link login'} <span>&rarr;</span></button>
        </form>
        {message && <p className="auth-message" role="status">{message}</p>}
        <p className="auth-footnote">Admin juga login melalui Supabase Auth, lalu akses `/admin` ditentukan oleh `admin_memberships`, bukan role dari user metadata.</p>
        <Link className="underlined-link" href="/">Kembali ke storefront <span>&rarr;</span></Link>
      </div>
    </main>
  );
}
