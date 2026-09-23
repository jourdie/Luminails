import Link from 'next/link';
import type { AccountIdentity } from '../lib/account';

export function AccountIdentity({ identity, context = 'customer' }: { identity: AccountIdentity; context?: 'customer' | 'admin' }) {
  const initials = identity.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'LN';
  return (
    <Link className={`account-identity account-identity-${context}`} href={context === 'admin' ? '/' : '/account'} aria-label={`Buka profil ${identity.name}`}>
      {identity.avatarUrl ? <img src={identity.avatarUrl} alt="" referrerPolicy="no-referrer" /> : <span className="account-avatar-fallback">{initials}</span>}
      <span className="account-identity-copy"><strong>{identity.name}</strong><small>{context === 'admin' ? 'Admin workspace' : 'Profil customer'}</small></span>
    </Link>
  );
}
