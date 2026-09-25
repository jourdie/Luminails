import Link from 'next/link';
import type { AccountIdentity, CustomerLoyalty, CustomerProfile } from '../lib/account';
import { SiteNavigation } from './site-navigation';
import type { AccountTierSummary } from '../lib/account-server';

const money = (value: number) => 'Rp' + new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value);
const points = (value: number) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value) + ' poin';
const tierName = (code: string) => code === 'VIP_2' ? 'VIP 2' : code === 'VIP_1' ? 'VIP 1' : code === 'BASIC' ? 'Basic' : code;

export function AccountOverview({ identity, profile, loyalty, needsProfile, tierSummary }: { identity: AccountIdentity; profile: CustomerProfile | null; loyalty: CustomerLoyalty | null; needsProfile: boolean; tierSummary: AccountTierSummary | null }) {
  const paidOrders = profile?.paid_order_count ?? 0;
  const lifetimeSpend = profile?.lifetime_paid_amount_idr ?? 0;
  const tier = loyalty?.tier_code ?? 'STANDARD';
  const multiplier = tierSummary?.multiplier ?? 1;
  const orderName = profile?.business_name?.trim() || identity.name;

  return <>
    <SiteNavigation identity={identity} profile={profile} needsProfile={needsProfile} tierSummary={tierSummary} />
    <main className="account-page">
      <div className="account-shell">
        <div className="account-heading">
          <div>
            <p className="eyebrow">Luminails customer account</p>
            <h1>Ruang order<br /><em>{orderName}.</em></h1>
            <p>Tier, histori pembelian, dan Luminails Points Anda ada di satu tempat.</p>
          </div>
          <div className="account-heading-actions">
            <Link className="button button-outline" href="/account/orders">Order history</Link>
            <Link className="button button-outline" href="/account/addresses">Alamat cabang</Link>
            <Link className="button button-outline" href="/account/profile">Edit profil</Link>
          </div>
        </div>
        <section className="account-stat-grid">
          <div className="account-stat account-stat-coral"><span>Tier saat ini</span><strong>{tierName(tier)}</strong><small>Multiplier points {multiplier}x</small></div>
          <div className="account-stat account-stat-lilac"><span>Paid orders</span><strong>{paidOrders}</strong><small>Order berhasil dibayar</small></div>
          <div className="account-stat account-stat-sage"><span>Rolling spend</span><strong>{money(tierSummary?.rollingSpend ?? lifetimeSpend)}</strong><small>Periode tier berjalan</small></div>
        </section>
        {tierSummary?.next && <section className="account-tier-progress"><div><p className="eyebrow">Next tier</p><h3>{tierSummary.next.name}</h3><p>Butuh total rolling spend {money(tierSummary.next.minimumSpend)} untuk membuka benefit berikutnya.</p></div><div><strong>{money(Math.max(0, tierSummary.next.minimumSpend - (tierSummary.rollingSpend ?? tierSummary.lifetimeSpend)))}</strong><small>lagi untuk next tier</small></div></section>}
        <section className="account-loyalty-card"><div><p className="eyebrow">Loyalty / Luminails Points</p><h2>{points(loyalty?.available_points ?? 0)}</h2><p>Poin dihitung dari spend eligible setelah diskon, bukan ongkir atau free item, dan dapat ditukar dengan reward.</p></div><div className="account-loyalty-rule"><span>Aturan Anda</span><strong>{tierName(tier)} &middot; {multiplier}x</strong><small>Rp10.000 spend eligible = 1 base point. Poin bukan uang dan tidak dapat diuangkan.</small></div></section>
        {needsProfile && <section className="account-profile-nudge"><div><p className="eyebrow">Lengkapi profil studio</p><h3>Supaya checkout berikutnya lebih cepat.</h3><p>Nama studio, nomor HP, dan alamat diperlukan untuk pengiriman package.</p></div><Link className="button button-dark" href="/account/profile">Lengkapi profil <span>-&gt;</span></Link></section>}
        <section className="account-how-it-works"><div><p className="eyebrow">How it works</p><h2>Belanja, kumpulkan,<br /><em>pilih produk gratis.</em></h2></div><div className="account-steps"><div><b>01</b><strong>Order dibayar</strong><span>Poin dihitung dari nilai order paid.</span></div><div><b>02</b><strong>Poin bertambah</strong><span>Multiplier mengikuti customer tier.</span></div><div><b>03</b><strong>Tukar poin ke reward</strong><span>Reward dipilih saat checkout berikutnya.</span></div></div></section>
      </div>
    </main>
  </>;
}
