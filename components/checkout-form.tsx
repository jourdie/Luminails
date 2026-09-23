'use client';

import { useActionState, useState } from 'react';
import type { BrandPackage } from '../lib/packages';
import { formatIDR } from '../lib/packages';
import { submitCheckoutOrder, type CheckoutActionState } from '../app/checkout/actions';

type Address = { id: string; label: string; recipient_name: string; phone: string; address_line: string; city: string; province: string | null; postal_code: string | null; is_default: boolean };
type Reward = { sku_id: string; name: string; points_cost: number };
const initialState: CheckoutActionState = { ok: false, message: '' };

export function CheckoutForm({ item, quantity, notes, addresses, points, rewards }: { item: BrandPackage; quantity: number; notes: string; addresses: Address[]; points: number; rewards: Reward[] }) {
  const [state, formAction, pending] = useActionState(submitCheckoutOrder, initialState);
  const [shippingMethod, setShippingMethod] = useState('paxel_factory');
  const [rewardSku, setRewardSku] = useState('');
  const selectedReward = rewards.find((reward) => reward.sku_id === rewardSku);
  const idempotencyKey = useState(() => crypto.randomUUID())[0];
  return <form className="checkout-form" action={formAction}>
    <input type="hidden" name="package_slug" value={item.slug} />
    <input type="hidden" name="quantity" value={quantity} />
    <input type="hidden" name="idempotency_key" value={idempotencyKey} />
    <div className="checkout-form-section"><span className="checkout-kicker">01 / Delivery profile</span><h3>Pilih alamat cabang</h3>{addresses.length ? <select name="address_id" defaultValue={addresses.find((address) => address.is_default)?.id ?? addresses[0]?.id} required>{addresses.map((address) => <option key={address.id} value={address.id}>{address.label} — {address.recipient_name}, {address.city}</option>)}</select> : <div className="checkout-empty"><p>Belum ada alamat tersimpan. Tambahkan alamat studio dulu agar order bisa diproses.</p><a href="/account/addresses">Kelola alamat</a></div>}</div>
    <div className="checkout-form-section"><span className="checkout-kicker">02 / Delivery route</span><h3>Metode pengiriman</h3><select name="shipping_method" value={shippingMethod} onChange={(event) => setShippingMethod(event.target.value)}><option value="paxel_factory">Paxel partner — next day, gratis ongkir</option><option value="third_party">Kurir pihak ketiga — provider menyusul</option><option value="pickup">Pickup / koordinasi manual</option></select><input name="shipping_provider" defaultValue={shippingMethod === 'paxel_factory' ? 'paxel' : ''} placeholder="Kode provider jika sudah dipilih" /></div>
    <div className="checkout-form-section"><span className="checkout-kicker">03 / Promotion access</span><h3>Promo eligible untuk Anda</h3><input name="promotion_code" placeholder="Masukkan kode promo / voucher" /><p className="checkout-help">Sistem akan memvalidasi tier, jumlah order, minimum order, periode, limit pemakaian, dan target package di server.</p></div>
    <div className="checkout-form-section"><span className="checkout-kicker">04 / Luminails Points</span><h3>Free product dengan poin</h3><p className="checkout-help">Poin bukan uang, tidak bisa diuangkan, dan tidak memotong total order. Pilih reward jika saldo poin mencukupi.</p>{rewards.length && points > 0 ? <select name="reward_sku_id" value={rewardSku} onChange={(event) => setRewardSku(event.target.value)}><option value="">Tidak menggunakan poin</option>{rewards.map((reward) => <option key={reward.sku_id} value={reward.sku_id}>{reward.name} — {reward.points_cost.toLocaleString('id-ID')} poin</option>)}</select> : <p className="checkout-points-balance">Saldo saat ini: <strong>{points.toLocaleString('id-ID')} poin</strong>. Reward akan muncul setelah admin mengatur katalog reward.</p>}<input type="hidden" name="reward_points" value={selectedReward?.points_cost ?? 0} /></div>
    <div className="checkout-form-section"><span className="checkout-kicker">05 / Notes</span><h3>Catatan untuk tim</h3><textarea name="customer_notes" defaultValue={notes} placeholder="Catatan packing, preferensi shade, atau instruksi cabang." /></div>
    {state.message && <p className="checkout-message" role="alert">{state.message}</p>}
    <button className="brand-button brand-button-dark checkout-submit" disabled={pending || !addresses.length}>{pending ? 'Membuat order...' : 'Buat order untuk direview'} <span>→</span></button>
    <p className="checkout-help">Payment gateway belum diaktifkan. Order akan masuk ke back office dengan status menunggu review; pembayaran dapat ditautkan kemudian ke Midtrans atau Xendit.</p>
  </form>;
}
