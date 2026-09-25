'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AccountIdentity } from './account-identity';
import { WhatsAppBubble } from './whatsapp-bubble';
import type { AccountIdentity as AccountIdentityData, CustomerProfile } from '../lib/account';

type SiteNavigationProps = {
  identity?: AccountIdentityData | null;
  profile?: CustomerProfile | null;
  needsProfile?: boolean;
  cartCount?: number;
  onCartOpen?: () => void;
  onLoginOpen?: () => void;
  tierSummary?: { name: string; next: { name: string; minimumSpend: number; minimumOrders: number } | null } | null;
};

export function SiteNavigation({ identity = null, profile = null, needsProfile = false, cartCount = 0, onCartOpen, onLoginOpen, tierSummary = null }: SiteNavigationProps) {
  const [mobileMenu, setMobileMenu] = useState(false);
  const closeMenu = () => setMobileMenu(false);

  return (
    <><header className="site-header site-header-global">
      <Link className="brand" href="/" aria-label="Luminails home" onClick={closeMenu}>luminails<span className="brand-dot">.</span></Link>
      <nav className={`main-nav${mobileMenu ? ' mobile-open' : ''}`} aria-label="Navigasi utama">
        <Link href="/packages" onClick={closeMenu}>Packages</Link>
        <Link href="/brands" onClick={closeMenu}>Brands</Link>
        <Link href="/education" onClick={closeMenu}>Education</Link>
      </nav>
      <div className="header-actions">
        {identity ? <><AccountIdentity identity={identity} />{tierSummary && <Link className="header-tier-pill" href="/account"><strong>{tierSummary.name}</strong>{tierSummary.next ? <small>Next: {tierSummary.next.name}</small> : <small>Tier tertinggi</small>}</Link>}{needsProfile && <Link className="profile-nudge" href="/account/profile">{profile?.business_name ? 'Perbarui profil' : 'Lengkapi profil'}</Link>}</> : onLoginOpen ? <button className="text-button" onClick={onLoginOpen}>Masuk B2B</button> : <Link className="text-button" href="/auth">Masuk B2B</Link>}
        {onCartOpen && <button className="cart-button" onClick={onCartOpen} aria-label={`Buka keranjang, ${cartCount} item`}><span>Keranjang</span><b className="cart-count">{cartCount}</b></button>}
      </div>
      <button className="mobile-menu" onClick={() => setMobileMenu((open) => !open)} aria-label="Buka menu" aria-expanded={mobileMenu}><span></span><span></span></button>
    </header>
      <WhatsAppBubble />
    </>
  );
}
