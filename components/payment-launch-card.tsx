'use client';

import { useState } from 'react';

export function PaymentLaunchCard({ orderId, disabled = false }: { orderId: string; disabled?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function launchPayment() {
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/payments/midtrans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId }),
      });
      const result = await response.json() as { ok?: boolean; redirect_url?: string; message?: string };
      if (!response.ok || !result.ok || !result.redirect_url) throw new Error(result.message ?? 'Halaman pembayaran belum siap.');
      window.location.assign(result.redirect_url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Pembayaran belum dapat dibuka. Coba lagi.');
      setLoading(false);
    }
  }

  return <div className="payment-launch">
    <button className="button brand-button-dark payment-launch-button" type="button" onClick={launchPayment} disabled={disabled || loading}>
      {loading ? 'Menyiapkan pembayaran…' : 'Lanjutkan pembayaran'} <span aria-hidden="true">-&gt;</span>
    </button>
    {message && <p className="payment-error" role="alert">{message}</p>}
  </div>;
}
