'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
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
  tierSummary?: { name: string; availablePoints?: number; next: { name: string; minimumSpend: number; minimumOrders: number } | null } | null;
};

export function SiteNavigation({ identity = null, profile = null, needsProfile = false, cartCount = 0, onCartOpen, onLoginOpen, tierSummary = null }: SiteNavigationProps) {
  const [mobileMenu, setMobileMenu] = useState(false);
  const [storedCartCount, setStoredCartCount] = useState(0);
  useEffect(() => {
    const syncCart = () => {
      try {
        const raw = window.localStorage.getItem('luminails-cart');
        setStoredCartCount(raw ? 1 : 0);
      } catch {
        setStoredCartCount(0);
      }
    };
    syncCart();
    window.addEventListener('luminails-cart-updated', syncCart);
    return () => window.removeEventListener('luminails-cart-updated', syncCart);
  }, []);
  const closeMenu = () => setMobileMenu(false);

  return (
    <><header className="site-header site-header-global" data-sticky-navigation>
      <Link className="brand" href="/" aria-label="Luminails home" onClick={closeMenu}>luminails<span className="brand-dot">.</span></Link>
      <nav className={`main-nav${mobileMenu ? ' mobile-open' : ''}`} aria-label="Navigasi utama">
        <Link href="/packages" onClick={closeMenu}>Packages</Link><Link href="/catalog" onClick={closeMenu}>Catalog</Link>{identity && <Link href="/account/rewards" onClick={closeMenu}>Rewards</Link>}
        <Link href="/about" onClick={closeMenu}>About us</Link>
      </nav>
      <div className="header-actions">
        {identity ? <><AccountIdentity identity={identity} businessName={profile?.business_name} />{tierSummary && <><Link className="header-tier-pill" href="/account"><strong>{tierSummary.name}</strong>{tierSummary.next ? <small>Next: {tierSummary.next.name}</small> : <small>Tier tertinggi</small>}</Link><Link className="header-points-pill" href="/account/rewards"><strong>{Number(tierSummary.availablePoints ?? 0).toLocaleString('id-ID')} pts</strong><small>Points tersedia</small></Link></>}{needsProfile && <Link className="profile-nudge" href="/account/profile">{profile?.business_name ? 'Perbarui profil' : 'Lengkapi profil'}</Link>}</> : onLoginOpen ? <button className="text-button" onClick={onLoginOpen}>Masuk</button> : <Link className="text-button" href="/auth">Masuk</Link>}
        <>{onCartOpen ? <button className="cart-button" onClick={onCartOpen} aria-label={`Buka keranjang, ${cartCount} item`}><span className="cart-icon" aria-hidden="true">{String.fromCharCode(0x1f6d2)}</span><span className="cart-label">Keranjang</span><b className="cart-count">{cartCount}</b></button> : <Link className="cart-button" href="/cart" aria-label={`Buka keranjang, ${storedCartCount} item`}><span className="cart-icon" aria-hidden="true">{String.fromCharCode(0x1f6d2)}</span><span className="cart-label">Keranjang</span><b className="cart-count">{storedCartCount}</b></Link>}</>
      </div>
      <button className="mobile-menu" onClick={() => setMobileMenu((open) => !open)} aria-label="Buka menu" aria-expanded={mobileMenu}><span></span><span></span></button>
    </header>
      <WhatsAppBubble />
    </>
  );
}
