import Link from 'next/link';
import type { AccountIdentity } from '../lib/account';

export function AccountIdentity({ identity, businessName, context = 'customer' }: { identity: AccountIdentity; businessName?: string | null; context?: 'customer' | 'admin' }) {
  const displayName = context === 'customer' && businessName?.trim() ? businessName.trim() : identity.name;
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'LN';
  return (
    <Link className={`account-identity account-identity-${context}`} href={context === 'admin' ? '/' : '/account'} aria-label={`Buka profil ${displayName}`}>
      {identity.avatarUrl ? <img src={identity.avatarUrl} alt="" referrerPolicy="no-referrer" /> : <span className="account-avatar-fallback">{initials}</span>}
      <span className="account-identity-copy"><strong>{displayName}</strong><small>{context === 'admin' ? 'Admin workspace' : businessName ? 'Ruang bisnis' : 'Profil customer'}</small></span>
    </Link>
  );
}
