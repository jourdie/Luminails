import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PaymentLaunchCard } from '../../../components/payment-launch-card';
import { SiteNavigation } from '../../../components/site-navigation';
import { getAccountContext } from '../../../lib/account-server';
import { getCustomerOrders } from '../../../lib/orders-server';

export const dynamic = 'force-dynamic';

const money = (value: number) => 'Rp' + new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value);

export default async function PaymentPage({ params }: { params: Promise<{ orderId: string }> }) {
  const account = await getAccountContext({ lightweight: true });
  if (!account.identity) redirect('/auth?next=/account/orders');

  const { orderId } = await params;
  const order = (await getCustomerOrders()).find((candidate) => candidate.id === orderId);
  if (!order) redirect('/account/orders');

  const packageItem = order.items.find((item) => item.item_type === 'package');
  const isPaid = order.payment_status === 'paid' || order.status === 'paid' || order.status === 'fulfilling' || order.status === 'completed';
  const isPending = order.payment_status === 'pending' && ['submitted_for_review', 'awaiting_payment'].includes(order.status);
  const orderCode = order.id.slice(0, 8).toUpperCase();

  return <>
    <SiteNavigation identity={account.identity} profile={account.profile} needsProfile={account.needsProfile} tierSummary={account.tierSummary} />
    <main className="payment-page">
      <div className="payment-shell">
        <div className="payment-layout">
          <section className="payment-intro" aria-labelledby="payment-title">
            <p className="brand-eyebrow">Luminails / pembayaran</p>
            <h1 id="payment-title">Satu langkah lagi<br /><em>sebelum diproses.</em></h1>
            <p className="payment-lead">Order kamu sudah tercatat. Selesaikan pembayaran supaya tim Luminails bisa langsung menyiapkan paket untuk studio kamu.</p>
            <div className="payment-proof"><span>Order diamankan</span><strong>24 jam</strong><small>Konfirmasi pembayaran dilakukan otomatis oleh Midtrans.</small></div>
          </section>

          <section className="payment-card" aria-label="Ringkasan pembayaran">
            <div className="payment-card-top"><div><span className="payment-label">Order {orderCode}</span><h2>{packageItem?.product_name_snapshot ?? 'Order Luminails'}</h2></div><span className={`payment-status ${isPaid ? 'payment-status-paid' : ''}`}>{isPaid ? 'Sudah dibayar' : 'Menunggu pembayaran'}</span></div>
            <div className="payment-summary"><div><span>Total pembayaran</span><strong>{money(order.total_idr)}</strong></div><small>{order.items.filter((item) => item.item_type !== 'component').length} item utama · {order.shipping_method === 'paxel_factory' ? 'Paxel next day gratis' : order.shipping_provider ?? order.shipping_method}</small></div>
            {isPending && <PaymentLaunchCard orderId={order.id} />}
            {isPaid && <div className="payment-state-message"><strong>Pembayaran sudah diterima.</strong><span>Order kamu akan lanjut ke proses persiapan. Detail statusnya bisa dipantau dari riwayat order.</span></div>}
            {!isPending && !isPaid && <div className="payment-state-message payment-state-message-muted"><strong>Order ini tidak lagi menunggu pembayaran.</strong><span>Cek riwayat order untuk melihat status terbaru atau hubungi tim Luminails.</span></div>}
            <p className="payment-trust"><span aria-hidden="true">✦</span> Pembayaran diproses aman melalui Midtrans. Luminails tidak menyimpan data kartu kamu.</p>
          </section>
        </div>

        <section className="payment-steps" aria-label="Tahapan order">
          <div><b>01</b><strong>Order tercatat</strong><span>Detail paket dan alamat sudah tersimpan.</span></div>
          <div className="payment-step-active"><b>02</b><strong>Bayar online</strong><span>Pilih metode pembayaran yang paling nyaman.</span></div>
          <div><b>03</b><strong>Tim menyiapkan</strong><span>Kamu akan menerima update saat order bergerak.</span></div>
        </section>

        <div className="payment-footer-links"><Link href="/account/orders">← Kembali ke riwayat order</Link><span>Butuh bantuan? <a href="https://wa.me/6289501086888" target="_blank" rel="noreferrer">Chat Luminails</a></span></div>
      </div>
    </main>
  </>;
}
