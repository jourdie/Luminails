'use client';

import Link from 'next/link';
import type { AccountIdentity, CustomerProfile } from '../lib/account';
import type { AccountTierSummary } from '../lib/account-server';
import type { CustomerReward } from '../lib/rewards-server';
import { SiteNavigation } from './site-navigation';

const money = (value: number) => 'Rp' + new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value);
const formatPoints = (value: number) => new Intl.NumberFormat('id-ID').format(value);

export function CustomerRewards({ rewards, identity, profile, needsProfile, loyaltyPoints, pointUnitValueIdr, tierSummary }: { rewards: CustomerReward[]; identity: AccountIdentity; profile: CustomerProfile | null; needsProfile: boolean; loyaltyPoints: number; pointUnitValueIdr: number; tierSummary: AccountTierSummary | null }) {
  function chooseReward(reward: CustomerReward) {
    try {
      window.localStorage.setItem('luminails-selected-reward', JSON.stringify({ skuId: reward.skuId, pointsCost: reward.pointsCost, name: reward.name }));
    } catch {
      // Checkout still shows the complete reward selector if storage is unavailable.
    }
  }

  return <>
    <SiteNavigation identity={identity} profile={profile} needsProfile={needsProfile} tierSummary={tierSummary} />
    <main className="rewards-page">
      <section className="rewards-hero section-pad">
        <div>
          <p className="eyebrow"><span className="eyebrow-line"></span> Luminails / rewards</p>
          <h1>Reward yang terasa<br /><em>worth it.</em></h1>
        </div>
        <div className="rewards-hero-copy"><p>Tukar poin menjadi produk gratis di checkout package berikutnya. Pilih reward di sini, lalu sistem akan membawanya ke checkout.</p><Link className="underlined-link" href="/packages">Lihat package untuk redeem <span>-&gt;</span></Link></div>
      </section>

      <section className="rewards-balance section-pad">
        <div className="rewards-balance-main"><span className="eyebrow">Saldo yang bisa dipakai</span><strong>{formatPoints(loyaltyPoints)} <small>poin</small></strong><p>{tierSummary?.name ?? 'Customer'} · setiap {money(pointUnitValueIdr)} spend eligible menghasilkan 1 base point.</p></div>
        <div className="rewards-balance-rule"><span>Aturan redeem</span><strong>Gratis product, bukan potongan uang</strong><p>Reward dipilih saat checkout package dan tetap mengikuti stok, minimum order, serta tier.</p></div>
      </section>

      <section className="rewards-catalog section-pad" aria-labelledby="rewards-title">
        <div className="section-heading"><div><p className="eyebrow">Reward catalog</p><h2 id="rewards-title">Pilih produk gratis<br /><em>untuk order berikutnya.</em></h2></div><p className="section-intro">Harga point ditentukan dari HPP dan aturan program. Admin dapat menyesuaikannya jika perlu.</p></div>
        {rewards.length ? <div className="reward-card-grid">{rewards.map((reward) => <RewardCard key={reward.id} reward={reward} canAfford={loyaltyPoints >= reward.pointsCost} onChoose={chooseReward} />)}</div> : <div className="rewards-empty"><span>LN</span><h3>Belum ada reward live.</h3><p>Reward akan muncul di sini setelah catalog diaktifkan oleh admin.</p></div>}
      </section>

      <section className="rewards-flow section-pad" aria-label="Cara redeem reward">
        <div><p className="eyebrow">Cara redeem</p><h2>Browse. Pilih.<br /><em>Bawa ke checkout.</em></h2></div>
        <div className="rewards-flow-steps"><div><b>01</b><strong>Pilih reward</strong><span>Simpan reward yang kamu inginkan.</span></div><div><b>02</b><strong>Pilih package</strong><span>Reward hanya bisa ikut order package.</span></div><div><b>03</b><strong>Konfirmasi</strong><span>Points dan stok divalidasi server saat order dibuat.</span></div></div>
      </section>
    </main>
  </>;
}

function RewardCard({ reward, canAfford, onChoose }: { reward: CustomerReward; canAfford: boolean; onChoose: (reward: CustomerReward) => void }) {
  return <article className={`reward-card${canAfford ? '' : ' is-out-of-reach'}`}>
    <div className="reward-card-image">{reward.imageUrl ? <img src={reward.imageUrl} alt={reward.name} loading="lazy" /> : <span>FREE<br /><em>PRODUCT</em></span>}<small>{reward.sku}</small></div>
    <div className="reward-card-copy"><div className="product-topline"><span>{reward.minimumTierName ?? 'All tiers'}</span><span>{reward.rewardStock > 0 ? `${reward.rewardStock} tersisa` : 'Stock terjaga'}</span></div><h3>{reward.name}</h3><p>{reward.description ?? 'Produk pilihan untuk melengkapi studio kamu.'}</p><div className="reward-card-value"><strong>{formatPoints(reward.pointsCost)} pts</strong>{reward.normalSellingPriceIdr > 0 && <span>Nilai {money(reward.normalSellingPriceIdr)}</span>}</div>{reward.minimumOrderValueIdr > 0 && <small className="reward-card-condition">Min. order {money(reward.minimumOrderValueIdr)}</small>}<Link className={`button ${canAfford ? 'button-dark' : 'button-outline'} reward-card-action`} href="/packages" onClick={() => onChoose(reward)}>{canAfford ? 'Pilih untuk checkout' : 'Kumpulkan point dulu'} <span>-&gt;</span></Link></div>
  </article>;
}