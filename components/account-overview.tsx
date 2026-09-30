import Link from 'next/link';
import type { AccountIdentity, CustomerLoyalty, CustomerProfile } from '../lib/account';
import { SiteNavigation } from './site-navigation';
import type { AccountTierSummary } from '../lib/account-server';

const money = (value: number) => 'Rp' + new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value);
const points = (value: number) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value) + ' poin';
const tierName = (code: string) => code === 'VIP_2' ? 'VIP 2' : code === 'VIP_1' ? 'VIP 1' : code === 'BASIC' ? 'Basic' : code;
const decimal = (value: number) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(value);
const clampPercent = (value: number) => Math.min(100, Math.max(0, value));

export function AccountOverview({ identity, profile, loyalty, needsProfile, tierSummary }: { identity: AccountIdentity; profile: CustomerProfile | null; loyalty: CustomerLoyalty | null; needsProfile: boolean; tierSummary: AccountTierSummary | null }) {
  const paidOrders = profile?.paid_order_count ?? 0;
  const lifetimeSpend = profile?.lifetime_paid_amount_idr ?? 0;
  const tier = loyalty?.tier_code ?? 'STANDARD';
  const customerTier = tierSummary?.name ?? tierSummary?.code ?? 'Basic';
  const multiplier = tierSummary?.multiplier ?? 1;
  const pointUnitValue = money(tierSummary?.pointUnitValueIdr ?? 10000);
  const orderName = profile?.business_name?.trim() || identity.name;
  const roadmap = tierSummary?.roadmap ?? [];
  const currentRoadmapIndex = roadmap.findIndex((item) => item.code === tierSummary?.currentCustomerTierCode);
  const visibleRoadmap = (currentRoadmapIndex >= 0 ? roadmap.slice(currentRoadmapIndex, currentRoadmapIndex + 3) : roadmap.slice(0, 3)).map((item, index) => ({ item, index }));

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
            <Link className="button button-dark" href="/account/rewards">Redeem rewards</Link><Link className="button button-outline" href="/account/orders">Order history</Link>
            <Link className="button button-outline" href="/account/addresses">Alamat cabang</Link>
            <Link className="button button-outline" href="/account/profile">Edit profil</Link>
          </div>
        </div>
        <section className="account-stat-grid">
          <div className="account-stat account-stat-coral"><span>Tier akun saat ini</span><strong>{customerTier}</strong><small>Earning points dan benefit loyalty mengikuti tier ini.</small></div>
          <div className="account-stat account-stat-lilac"><span>Paid orders</span><strong>{paidOrders}</strong><small>Order berhasil dibayar</small></div>
          <div className="account-stat account-stat-sage"><span>Rolling spend</span><strong>{money(tierSummary?.rollingSpend ?? lifetimeSpend)}</strong><small>Periode tier berjalan</small></div>
        </section>
        {visibleRoadmap.length > 0 && <section className="account-tier-roadmap" aria-labelledby="account-tier-roadmap-title">
          <div className="account-tier-roadmap-intro">
            <div>
              <p className="eyebrow">Jalur benefit</p>
              <h2 id="account-tier-roadmap-title">Naik tier,<br /><em>benefit makin terasa.</em></h2>
            </div>
            <p>Lihat posisi tier kamu sekarang, target berikutnya, dan apa yang akan terbuka setelahnya. Progress dihitung dari belanja eligible dalam periode berjalan.</p>
          </div>
          <div className="tier-roadmap-track">
            {visibleRoadmap.map(({ item, index }) => {
              const isCurrent = item.code === tierSummary?.currentCustomerTierCode;
              const progress = item.minimumSpend <= 0 ? 100 : clampPercent((tierSummary?.rollingSpend ?? 0) / item.minimumSpend * 100);
              const remaining = Math.max(0, item.minimumSpend - (tierSummary?.rollingSpend ?? 0));
              const label = isCurrent ? 'Tier aktif' : index === 1 ? 'Berikutnya' : 'Setelahnya';
              const benefit = item.benefits || `Earning points ${decimal(item.pointsPer10000)}x per Rp10.000 belanja eligible.`;
              return <article className={`tier-roadmap-card ${isCurrent ? 'is-current' : index === 1 ? 'is-next' : 'is-future'}`} key={item.code}>
                <div className="tier-roadmap-card-top"><span>{label}</span><b>{String(index + 1).padStart(2, '0')}</b></div>
                <h3>{item.name}</h3>
                <p className="tier-roadmap-benefit">{benefit}</p>
                <div className="tier-roadmap-target">
                  <span>{isCurrent ? 'Progress tier saat ini' : 'Cara mencapai'}</span>
                  <strong>{isCurrent ? 'Tier aktif' : `Rolling spend ${money(item.minimumSpend)}`}</strong>
                  <small>{isCurrent ? `Earning ${decimal(item.multiplier)}x · periode ${item.rollingPeriodMonths} bulan` : `${remaining > 0 ? `Kurang ${money(remaining)}` : 'Target tercapai'} · dihitung ${item.rollingPeriodMonths} bulan`}</small>
                </div>
                <div className="tier-roadmap-progress" aria-label={`${item.name}: ${Math.round(progress)}% menuju target`}><i style={{ width: `${progress}%` }} /></div>
                <div className="tier-roadmap-progress-meta"><span>{Math.round(progress)}% tercapai</span><span>{isCurrent ? 'Pertahankan ritme order' : 'Belanja package untuk naik tier'}</span></div>
                {item.description && <p className="tier-roadmap-description">{item.description}</p>}
              </article>;
            })}
          </div>
          <p className="tier-roadmap-note">Points dihitung dari spend eligible setelah diskon, bukan ongkir atau free item. Target tier mengikuti rolling spend dan dapat berubah sesuai periode evaluasi akun.</p>
        </section>}        <section className="account-loyalty-card"><div><p className="eyebrow">Loyalty / Luminails Points</p><h2>{points(loyalty?.available_points ?? 0)}</h2><p>Poin dihitung dari spend eligible setelah diskon, bukan ongkir atau free item, dan dapat ditukar dengan reward.</p></div><div className="account-loyalty-rule"><span>Aturan Anda</span><strong>{tierName(tier)} &middot; {multiplier}x</strong><small>{pointUnitValue} spend eligible = 1 base point. Poin bukan uang dan tidak dapat diuangkan.</small></div></section>
        {needsProfile && <section className="account-profile-nudge"><div><p className="eyebrow">Lengkapi profil studio</p><h3>Supaya checkout berikutnya lebih cepat.</h3><p>Nama studio, nomor HP, dan alamat diperlukan untuk pengiriman package.</p></div><Link className="button button-dark" href="/account/profile">Lengkapi profil <span>-&gt;</span></Link></section>}
        <section className="account-how-it-works"><div><p className="eyebrow">How it works</p><h2>Belanja, kumpulkan,<br /><em>pilih produk gratis.</em></h2></div><div className="account-steps"><div><b>01</b><strong>Order dibayar</strong><span>Poin dihitung dari nilai order paid.</span></div><div><b>02</b><strong>Poin bertambah</strong><span>Multiplier mengikuti customer tier.</span></div><div><b>03</b><strong>Tukar poin ke reward</strong><span>Reward dipilih saat checkout berikutnya.</span></div></div></section>
      </div>
    </main>
  </>;
}
