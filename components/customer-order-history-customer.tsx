import Link from 'next/link';
import { CancelOrderForm } from './cancel-order-form';
import type { CustomerOrder } from '../lib/orders-server';
import { buildRepeatOrderHref } from '../lib/orders-server';

const money = (value: number) => 'Rp' + new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value);
const orderStatus: Record<string, string> = { submitted_for_review: 'Menunggu review', awaiting_payment: 'Menunggu pembayaran', paid: 'Dibayar', fulfilling: 'Disiapkan', completed: 'Selesai', cancelled: 'Dibatalkan' };
const paymentStatus: Record<string, string> = { pending: 'Belum dibayar', paid: 'Dibayar', failed: 'Gagal', refunded: 'Refund', partially_refunded: 'Sebagian refund' };
const shipmentStatus: Record<string, string> = { unallocated: 'Menunggu diproses', allocated: 'Disiapkan', packed: 'Dikemas', shipped: 'Dikirim', delivered: 'Sampai', cancelled: 'Dibatalkan' };

export function CustomerOrderHistoryCustomer({ orders, createdOrderId }: { orders: CustomerOrder[]; createdOrderId?: string }) {
  return <section className="order-history">
    <div className="account-panel order-history-intro"><p className="eyebrow">Luminails / riwayat order</p><h2>Order yang tetap<br /><em>terlihat jelas.</em></h2><p>Status transaksi, promo yang terpakai, paket, dan tracking akan muncul di sini.</p></div>
    {createdOrderId && <div className="order-success" role="status">Order <strong>{createdOrderId}</strong> sudah dibuat dan diterima tim Luminails untuk diproses.</div>}
    {orders.length ? <div className="order-history-list">{orders.map((order) => {
      const repeatHref = buildRepeatOrderHref(order);
      const shipment = order.shipment?.status ?? order.fulfillment_status;
      return <article className="order-history-card" key={order.id}>
        <div className="order-history-top"><div><span className="eyebrow">Order {order.id.slice(0, 8).toUpperCase()}</span><h3>{order.items.find((item) => item.item_type === 'package')?.product_name_snapshot ?? 'Order Luminails'}</h3><small>{new Date(order.created_at).toLocaleString('id-ID')}</small></div><strong>{money(order.total_idr)}</strong></div>
        <div className="order-status-grid"><span>Status order<strong>{orderStatus[order.status] ?? 'Sedang diproses'}</strong></span><span>Pembayaran<strong>{paymentStatus[order.payment_status] ?? 'Sedang diperiksa'}</strong></span><span>Pengiriman<strong>{shipmentStatus[shipment] ?? 'Sedang diproses'}</strong></span></div>
        <div className="order-item-lines">{order.items.filter((item) => item.item_type !== 'component').map((item) => <div key={item.id}><span>{item.product_name_snapshot} × {item.quantity}</span><strong>{item.item_type === 'loyalty_reward' ? 'Produk reward' : money(item.unit_price_idr * item.quantity)}</strong></div>)}</div>
        <div className="order-history-foot"><span>{order.promotion_code ? 'Promo ' + order.promotion_code : 'Tanpa promo'} · {order.shipping_method === 'paxel_factory' ? 'Paxel next day gratis' : order.shipping_provider ?? order.shipping_method}</span><div className="order-history-links">{repeatHref && <Link className="underlined-link" href={repeatHref}>Beli lagi</Link>}{order.shipment?.tracking_url ? <a href={order.shipment.tracking_url} target="_blank" rel="noreferrer">Lihat tracking →</a> : <span>Nomor resi akan muncul setelah dikirim</span>}{['submitted_for_review', 'awaiting_payment'].includes(order.status) && <CancelOrderForm orderId={order.id} />}</div></div>
      </article>;
    })}</div> : <div className="account-panel order-empty"><h3>Belum ada order.</h3><p>Mulai dari paket untuk studio dan salon.</p><Link className="button button-dark" href="/packages">Lihat paket <span>-&gt;</span></Link></div>}
  </section>;
}
