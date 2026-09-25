'use client';

import { useActionState, useState } from 'react';
import type { BrandPackage } from '../lib/packages';
import { submitCheckoutOrder, type CheckoutActionState } from '../app/checkout/actions';
import { saveAddress, type AddressActionState } from '../app/account/addresses/actions';

type Address = { id: string; label: string; recipient_name: string; phone: string; address_line: string; city: string; province: string | null; postal_code: string | null; is_default: boolean; notes?: string | null };
type Reward = { sku_id: string; name: string; points_cost: number; reward_stock: number; max_redemption_quantity: number; minimum_order_value_idr: number };
type SelectedBenefit = { benefitId: string; skuId: string; quantity: number };
const initialState: CheckoutActionState = { ok: false, message: '' };

export function CheckoutForm({ item, quantity, notes, selectedSkus, selectedBenefits, addresses, points, pendingPoints, rewards, contactPhone }: { item: BrandPackage; quantity: number; notes: string; selectedSkus: Array<{ skuId: string; quantity: number }>; selectedBenefits: SelectedBenefit[]; addresses: Address[]; points: number; pendingPoints: number; rewards: Reward[]; contactPhone: string }) {
  const [state, formAction, pending] = useActionState(submitCheckoutOrder, initialState);
  const [addressState, addressAction, addressPending] = useActionState<AddressActionState, FormData>(saveAddress, { ok: false, message: '' });
  const [shippingMethod, setShippingMethod] = useState('paxel_factory');
  const [rewardSku, setRewardSku] = useState('');
  const [rewardQuantity, setRewardQuantity] = useState(1);
  const selectedReward = rewards.find((reward) => reward.sku_id === rewardSku);
  const idempotencyKey = useState(() => crypto.randomUUID())[0];
  const maxRewardQuantity = selectedReward ? Math.min(selectedReward.max_redemption_quantity, selectedReward.reward_stock > 0 ? selectedReward.reward_stock : selectedReward.max_redemption_quantity) : 1;
  const redeemedPoints = selectedReward ? selectedReward.points_cost * rewardQuantity : 0;
  const projectedPoints = points - redeemedPoints + pendingPoints;
  const canRedeem = item.allowRewardRedemption !== false;

  return <div className={'checkout-form'}>
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
    <form className={'checkout-form'} action={formAction}>
    <input type={'hidden'} name={'package_slug'} value={item.slug} />
    <input type={'hidden'} name={'quantity'} value={quantity} />
    <input type={'hidden'} name={'selected_skus'} value={JSON.stringify(selectedSkus)} />
    <input type={'hidden'} name={'selected_benefits'} value={JSON.stringify(selectedBenefits)} />
    <input type={'hidden'} name={'idempotency_key'} value={idempotencyKey} />
    <div className={'checkout-form-section'}><span className={'checkout-kicker'}>01 / Delivery profile</span><h3>Pilih alamat cabang</h3>{addresses.length ? <select name={'address_id'} defaultValue={addresses.find((address) => address.is_default)?.id ?? addresses[0]?.id} required>{addresses.map((address) => <option key={address.id} value={address.id}>{address.label} - {address.recipient_name}, {address.city}</option>)}</select> : <div className={'checkout-empty'}><p>Belum ada alamat tersimpan. Tambahkan alamat studio dulu agar order bisa diproses.</p><a href={'/account/addresses'}>Kelola alamat</a></div>}<label>Nomor HP untuk update order<input name={'contact_phone'} type={'tel'} defaultValue={contactPhone} autoComplete={'tel'} required /></label><p className={'checkout-help'}>Boleh berbeda dari nomor profil; dipakai untuk update order dan WhatsApp.</p></div>
    <div className={'checkout-form-section'}><span className={'checkout-kicker'}>02 / Delivery route</span><h3>Metode pengiriman</h3><select name={'shipping_method'} value={shippingMethod} onChange={(event) => setShippingMethod(event.target.value)}><option value={'paxel_factory'}>Paxel partner - next day, gratis ongkir</option><option value={'third_party'}>Kurir pihak ketiga - provider menyusul</option><option value={'pickup'}>Pickup / koordinasi manual</option></select><input name={'shipping_provider'} defaultValue={'paxel'} placeholder={'Kode provider jika sudah dipilih'} /></div>
    <div className={'checkout-form-section'}><span className={'checkout-kicker'}>03 / Promotion access</span><h3>Promo eligible untuk Anda</h3><input name={'promotion_code'} placeholder={'Masukkan kode promo / voucher'} /><p className={'checkout-help'}>Sistem akan memvalidasi tier, jumlah order, minimum order, periode, limit pemakaian, dan target package di server.</p></div>
    <div className={'checkout-form-section'}><span className={'checkout-kicker'}>04 / Luminails Points</span><h3>Free product dengan poin</h3><p className={'checkout-help'}>Poin bukan uang, tidak bisa diuangkan, dan tidak memotong total order. Poin dari order ini belum dapat dipakai di order yang sama.</p>{!canRedeem ? <p className={'checkout-points-balance'}>Package ini tidak dapat digabung dengan redemption reward.</p> : rewards.length && points > 0 ? <><select name={'reward_sku_id'} value={rewardSku} onChange={(event) => { setRewardSku(event.target.value); setRewardQuantity(1); }}><option value={''}>Tidak menggunakan poin</option>{rewards.map((reward) => <option key={reward.sku_id} value={reward.sku_id} disabled={points < reward.points_cost}>{reward.name} - {reward.points_cost.toLocaleString('id-ID')} poin{reward.reward_stock > 0 ? ' - stok ' + reward.reward_stock : ''}</option>)}</select>{selectedReward && <label>Jumlah reward<input name={'reward_quantity_display'} type={'number'} min={1} max={maxRewardQuantity} value={rewardQuantity} onChange={(event) => setRewardQuantity(Math.max(1, Math.min(maxRewardQuantity, Number(event.target.value) || 1)))} /><small className={'field-help'}>Maksimal {maxRewardQuantity} item per order. Total: {redeemedPoints.toLocaleString('id-ID')} pts.</small></label>}</> : <p className={'checkout-points-balance'}>Saldo saat ini: <strong>{points.toLocaleString('id-ID')} poin</strong>. Reward akan muncul setelah admin mengatur katalog reward.</p>}<input type={'hidden'} name={'reward_points'} value={selectedReward?.points_cost ?? 0} /><input type={'hidden'} name={'reward_quantity'} value={selectedReward ? rewardQuantity : 1} /><div className={'checkout-points-preview'}><span>Current points <strong>{points.toLocaleString('id-ID')} pts</strong></span><span>Dipakai sekarang <strong>-{redeemedPoints.toLocaleString('id-ID')} pts</strong></span><span>Pending dari order <strong>+{pendingPoints.toLocaleString('id-ID')} pts</strong></span><span>Projected after completion <strong>{projectedPoints.toLocaleString('id-ID')} pts</strong></span></div></div>
    <div className={'checkout-form-section'}><span className={'checkout-kicker'}>05 / Notes</span><h3>Catatan untuk tim</h3><textarea name={'customer_notes'} defaultValue={notes} placeholder={'Catatan packing, preferensi shade, atau instruksi cabang.'} /></div>
    {state.message && <p className={'checkout-message'} role={'alert'}>{state.message}</p>}
    <button className={'brand-button brand-button-dark checkout-submit'} disabled={pending || !addresses.length}>{pending ? 'Membuat order...' : 'Buat order untuk direview'} <span>-&gt;</span></button>
    <p className={'checkout-help'}>Payment gateway belum diaktifkan. Order akan masuk ke back office dengan status menunggu review; pembayaran dapat ditautkan kemudian ke Midtrans atau Xendit.</p>
    </form>
  </div>;
}
