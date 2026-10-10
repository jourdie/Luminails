'use client';

import { useEffect, useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatIDR, type BrandPackage, type PackageAddOn } from '../lib/packages';
import { submitCheckoutOrder, type CheckoutActionState } from '../app/checkout/actions';
import { saveAddress, type AddressActionState } from '../app/account/addresses/actions';
import { calculateEarnedPoints } from '../lib/loyalty-engine';

type Address = { id: string; label: string; recipient_name: string; phone: string; address_line: string; city: string; province: string | null; postal_code: string | null; is_default: boolean; notes?: string | null };
type Reward = { sku_id: string; name: string; points_cost: number; reward_stock: number; max_redemption_quantity: number; minimum_order_value_idr: number };
type SelectedBenefit = { benefitId: string; skuId: string; quantity: number };
const initialState: CheckoutActionState = { ok: false, message: '' };

export function CheckoutForm({ item, quantity, notes, selectedSkus, selectedBenefits, addresses, points, pendingPoints, packageSubtotal, tierName, tierMultiplier, pointUnitValueIdr, checkoutWarning, rewards, addOns, contactPhone }: { item: BrandPackage; quantity: number; notes: string; selectedSkus: Array<{ skuId: string; quantity: number }>; selectedBenefits: SelectedBenefit[]; addresses: Address[]; points: number; pendingPoints: number; packageSubtotal: number; tierName: string | null; tierMultiplier: number; pointUnitValueIdr: number; checkoutWarning: string | null; rewards: Reward[]; addOns: PackageAddOn[]; contactPhone: string }) {
  const [state, formAction, pending] = useActionState(submitCheckoutOrder, initialState);
  const [addressState, addressAction, addressPending] = useActionState<AddressActionState, FormData>(saveAddress, { ok: false, message: '' });
  const router = useRouter();
  useEffect(() => { if (addressState.ok) router.refresh(); }, [addressState, router]);
  const [shippingMethod, setShippingMethod] = useState('paxel_factory');
  const [rewardSku, setRewardSku] = useState('');
  const [addOnSelection, setAddOnSelection] = useState<Record<string, number>>({});
  const [rewardQuantity, setRewardQuantity] = useState(1);
  const selectedReward = rewards.find((reward) => reward.sku_id === rewardSku);
  const checkoutKeyStorage = `luminails-checkout-key:${item.slug}:${quantity}`;
  const [idempotencyKey, setIdempotencyKey] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        const existing = window.sessionStorage.getItem(checkoutKeyStorage);
        if (existing) return existing;
      }
    } catch {
      // Session storage can be unavailable in privacy-restricted browsers.
    }
    return crypto.randomUUID();
  });
  useEffect(() => {
    try {
      window.sessionStorage.setItem(checkoutKeyStorage, idempotencyKey);
    } catch {
      // The database unique key still protects the current page session.
    }
  }, [checkoutKeyStorage, idempotencyKey]);
  function rotateIdempotencyKey() {
    setIdempotencyKey(crypto.randomUUID());
  }
  const maxRewardQuantity = selectedReward ? Math.min(selectedReward.max_redemption_quantity, selectedReward.reward_stock > 0 ? selectedReward.reward_stock : selectedReward.max_redemption_quantity) : 1;
  const redeemedPoints = selectedReward ? selectedReward.points_cost * rewardQuantity : 0;

  const canRedeem = item.allowRewardRedemption !== false;
  useEffect(() => {
    if (!canRedeem || !rewards.length) return;
    try {
      const raw = window.localStorage.getItem('luminails-selected-reward');
      if (!raw) return;
      const selected = JSON.parse(raw) as { skuId?: string; pointsCost?: number };
      const reward = rewards.find((item) => item.sku_id === selected.skuId && item.points_cost === Number(selected.pointsCost));
      if (reward && points >= reward.points_cost) setRewardSku(reward.sku_id);
      window.localStorage.removeItem('luminails-selected-reward');
    } catch {
      // The normal reward selector remains available if storage contains invalid data.
    }
  }, [canRedeem, points, rewards]);
  const addOnTotal = addOns.reduce((total, addOn) => total + (addOnSelection[addOn.id] ?? 0) * addOn.price, 0);
  const orderSubtotal = packageSubtotal + addOnTotal;
  const estimatedPendingPoints = item.pointsEarningMode === 'none' ? 0 : Math.floor(calculateEarnedPoints(orderSubtotal, 0, tierMultiplier, pointUnitValueIdr) * (item.pointsEarningMode === 'reduced' ? Math.min(1, item.pointsMultiplier ?? 1) : (item.pointsMultiplier ?? 1)));
  const projectedPoints = points - redeemedPoints + estimatedPendingPoints;

  function adjustAddOn(addOnId: string, delta: number) {
    setAddOnSelection((current) => {
      const nextValue = Math.max(0, Math.min(100, (current[addOnId] ?? 0) + delta));
      const next = { ...current };
      if (nextValue === 0) delete next[addOnId]; else next[addOnId] = nextValue;
      return next;
    });
  }

  return <div className={'checkout-form'}>
    {checkoutWarning && <p className={'checkout-warning'} role={'alert'}>{checkoutWarning}</p>}<section className={'checkout-live-summary'}><div><span className={'checkout-kicker'}>Total order</span><h3>Ringkasan order kamu</h3></div><div className={'checkout-live-summary-lines'}><span><small>Paket</small><strong>{formatIDR(packageSubtotal)}</strong></span><span><small>Tambahan</small><strong>{formatIDR(addOnTotal)}</strong></span><span className={'is-total'}><small>Total sementara</small><strong>{formatIDR(orderSubtotal)}</strong></span><span><small>Poin {tierName ? '· ' + tierName : ''}</small><strong>+{estimatedPendingPoints.toLocaleString('id-ID')} poin</strong></span></div><p className={'checkout-help'}>Poin dihitung dari subtotal transaksi dan tier akun, lalu dikonfirmasi saat order dibuat.</p></section>
    <section className={'checkout-address-create'}>
      <details open={!addresses.length}>
        <summary>+ Tambah alamat cabang baru</summary>
        <form className={'checkout-inline-address'} action={addressAction}>
          <label>Nama cabang<input name={'label'} placeholder={'Contoh: Studio Kemang'} required /></label>
          <label>Nama penerima<input name={'recipient_name'} placeholder={'Nama penerima'} required /></label>
          <label>Nomor HP cabang<input name={'phone'} type={'tel'} placeholder={'08xxxxxxxxxx'} required /></label>
          <label>Alamat lengkap<textarea name={'address_line'} placeholder={'Alamat jalan dan nomor'} required /></label>
          <label>Kota<input name={'city'} placeholder={'Kota'} required /></label>
          <label>Provinsi<input name={'province'} placeholder={'Provinsi'} /></label>
          <label>Kode pos<input name={'postal_code'} inputMode={'numeric'} placeholder={'12345'} /></label>
          <label>Catatan alamat<textarea name={'notes'} placeholder={'Patokan atau instruksi kurir'} /></label>
          {addressState.message && <p className={'checkout-message'} role={'alert'}>{addressState.message}</p>}
          <button className={'brand-button brand-button-dark'} type={'submit'} disabled={addressPending}>{addressPending ? 'Menyimpan...' : 'Simpan alamat cabang'}</button>
        </form>
      </details>
    </section>
     <p className={'checkout-help'}>Satu checkout diproses untuk satu brand. Tambahan dan reward mengikuti paket ini; poin tetap bisa digunakan pada order brand lain berikutnya.</p>
     <form className={'checkout-form'} action={formAction} onChange={rotateIdempotencyKey}>
    <input type={'hidden'} name={'package_slug'} value={item.slug} />
    <input type={'hidden'} name={'quantity'} value={quantity} />
    <input type={'hidden'} name={'selected_skus'} value={JSON.stringify(selectedSkus)} />
    <input type={'hidden'} name={'selected_benefits'} value={JSON.stringify(selectedBenefits)} />
    <input type={'hidden'} name={'add_on_skus'} value={JSON.stringify(Object.entries(addOnSelection).filter(([, value]) => value > 0).map(([skuId, value]) => ({ skuId, quantity: value })))} />
    <input type={'hidden'} name={'idempotency_key'} value={idempotencyKey} />
    <div className={'checkout-form-section'}><span className={'checkout-kicker'}>01 / Alamat pengiriman</span><h3>Pilih alamat cabang</h3>{addresses.length ? <select name={'address_id'} defaultValue={addresses.find((address) => address.is_default)?.id ?? addresses[0]?.id} required>{addresses.map((address) => <option key={address.id} value={address.id}>{address.label} - {address.recipient_name}, {address.city}</option>)}</select> : <div className={'checkout-empty'}><p>Belum ada alamat tersimpan. Tambahkan alamat studio dulu agar order bisa diproses.</p><a href={'/account/addresses'}>Kelola alamat</a></div>}<label>Nomor HP untuk update order<input name={'contact_phone'} type={'tel'} defaultValue={contactPhone} autoComplete={'tel'} required /></label><p className={'checkout-help'}>Boleh berbeda dari nomor profil; dipakai untuk update order dan WhatsApp.</p></div>
    <div className={'checkout-form-section'}><span className={'checkout-kicker'}>02 / Pengiriman</span><h3>Metode pengiriman</h3><select name={'shipping_method'} value={shippingMethod} onChange={(event) => setShippingMethod(event.target.value)}><option value={'paxel_factory'}>Paxel partner - next day, gratis ongkir</option><option value={'third_party'}>Kurir pihak ketiga - provider menyusul</option><option value={'pickup'}>Pickup / koordinasi manual</option></select><input name={'shipping_provider'} defaultValue={'paxel'} placeholder={'Kode provider jika sudah dipilih'} /></div>
    {addOns.length > 0 && <div className={'checkout-form-section checkout-add-on-section'}><span className={'checkout-kicker'}>03 / Tambahan untuk studio</span><h3>Tambah tools setelah paket</h3><p className={'checkout-help'}>Tools dan aksesori dapat ditambahkan setelah paket dipilih. Harga di bawah adalah harga produk.</p><div className={'checkout-add-on-list'}>{addOns.map((addOn) => <div className={'checkout-add-on-row'} key={addOn.id}><div><strong>{addOn.name}</strong><small>{addOn.sku} · {addOn.categoryLabel} · {formatIDR(addOn.price)} / pcs</small></div><div className={'quantity-control'}><button type={'button'} onClick={() => adjustAddOn(addOn.id, -1)} disabled={!addOnSelection[addOn.id]}>-</button><span>{addOnSelection[addOn.id] ?? 0}</span><button type={'button'} onClick={() => adjustAddOn(addOn.id, 1)} disabled={addOnSelection[addOn.id] >= 100}>+</button></div></div>)}</div>{addOnTotal > 0 && <div className={'checkout-add-on-total'}><span>Total tambahan</span><strong>{formatIDR(addOnTotal)}</strong></div>}</div>}    <div className={'checkout-form-section'}><span className={'checkout-kicker'}>{addOns.length > 0 ? '04' : '03'} / Promo</span><h3>Punya kode promo?</h3><input name={'promotion_code'} placeholder={'Masukkan kode promo…'} /><p className={'checkout-help'}>Kode promo akan diperiksa berdasarkan tier akun, jumlah order, periode, dan ketentuan yang berlaku.</p></div>
    <div className={'checkout-form-section'}><span className={'checkout-kicker'}>{addOns.length > 0 ? '05' : '04'} / Poin Luminails</span><h3>Produk gratis dengan poin</h3><p className={'checkout-help'}>Poin bukan uang dan tidak memotong total order. Poin dari order ini belum dapat dipakai pada order yang sama.</p>{!canRedeem ? <p className={'checkout-points-balance'}>Paket ini tidak dapat digabung dengan penukaran reward.</p> : rewards.length && points > 0 ? <><select name={'reward_sku_id'} value={rewardSku} onChange={(event) => { setRewardSku(event.target.value); setRewardQuantity(1); }}><option value={''}>Tidak menggunakan poin</option>{rewards.map((reward) => <option key={reward.sku_id} value={reward.sku_id} disabled={points < reward.points_cost}>{reward.name} - {reward.points_cost.toLocaleString('id-ID')} poin{reward.reward_stock > 0 ? ' - stok ' + reward.reward_stock : ''}</option>)}</select>{selectedReward && <label>Jumlah reward<input name={'reward_quantity_display'} type={'number'} min={1} max={maxRewardQuantity} value={rewardQuantity} onChange={(event) => setRewardQuantity(Math.max(1, Math.min(maxRewardQuantity, Number(event.target.value) || 1)))} /><small className={'field-help'}>Maksimal {maxRewardQuantity} item per order. Total: {redeemedPoints.toLocaleString('id-ID')} poin.</small></label>}</> : <p className={'checkout-points-balance'}>Saldo saat ini: <strong>{points.toLocaleString('id-ID')} poin</strong>. Pilihan reward akan muncul saat tersedia.</p>}<input type={'hidden'} name={'reward_points'} value={selectedReward?.points_cost ?? 0} /><input type={'hidden'} name={'reward_quantity'} value={selectedReward ? rewardQuantity : 1} /><div className={'checkout-points-preview'}><span>Poin saat ini <strong>{points.toLocaleString('id-ID')} poin</strong></span><span>Dipakai sekarang <strong>-{redeemedPoints.toLocaleString('id-ID')} poin</strong></span><span>Dari order ini <strong>+{estimatedPendingPoints.toLocaleString('id-ID')} poin</strong></span><span>Setelah order selesai <strong>{projectedPoints.toLocaleString('id-ID')} poin</strong></span></div></div>
    <div className={'checkout-form-section'}><span className={'checkout-kicker'}>{addOns.length > 0 ? '06' : '05'} / Catatan</span><h3>Catatan untuk tim Luminails</h3><textarea name={'customer_notes'} defaultValue={notes} placeholder={'Catatan packing, preferensi shade, atau instruksi cabang.'} /></div>
    {state.message && <p className={'checkout-message'} role={'alert'}>{state.message}</p>}
    <button className={'brand-button brand-button-dark checkout-submit'} disabled={pending || !addresses.length || Boolean(checkoutWarning)}>{pending ? 'Membuat order…' : 'Kirim order'} <span>-&gt;</span></button>
    <p className={'checkout-help'}>Setelah dikirim, tim Luminails akan memeriksa detail order dan menghubungi kamu untuk konfirmasi pembayaran.</p>
    </form>
  </div>;
}
