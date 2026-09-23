'use client';

import { useActionState } from 'react';
import { setAdminMembershipStatus, upsertAdminMembership, type AdminActionState } from '../app/admin/actions';
import type { AdminMembership } from '../lib/admin';

const ADMIN_PERMISSION_KEYS = ['catalog', 'orders', 'notifications', 'pricing', 'promotions', 'packages', 'inventory', 'settings'] as const;

const initialState: AdminActionState = { ok: false, message: '' };

const permissionLabels: Record<(typeof ADMIN_PERMISSION_KEYS)[number], string> = {
  catalog: 'Produk & katalog',
  orders: 'Transaksi',
  notifications: 'Notifikasi',
  pricing: 'Pricing B2B',
  promotions: 'Promosi',
  packages: 'Package & brand',
  inventory: 'Inventory',
  settings: 'WhatsApp setting',
};

const roleLabels: Record<Exclude<AdminMembership['role'], 'owner'>, string> = {
  catalog_manager: 'Catalog manager',
  orders_manager: 'Orders manager',
  support: 'Support',
};

export function AdminMembershipConsole({ memberships, canManage }: { memberships: AdminMembership[]; canManage: boolean }) {
  const [state, formAction, pending] = useActionState(upsertAdminMembership, initialState);

  if (!canManage) return null;

  return (
    <div className="admin-membership-stack">
      <section className="admin-panel admin-membership-create">
        <div className="panel-heading">
          <div><p className="eyebrow">Access control</p><h3>Tambah atau ubah admin</h3></div>
          <span className="notification-count">Owner only</span>
        </div>
        <p className="admin-help-copy">Email harus sudah pernah login dengan Google di aplikasi. Pilih role sebagai titik awal, lalu sesuaikan permission di bawah.</p>
        <form className="admin-membership-form" action={formAction}>
          <label>Email Google<input name="email" type="email" placeholder="admin@studio.com" required /></label>
          <label>Role
            <select name="role" defaultValue="support">
              <option value="catalog_manager">Catalog manager</option>
              <option value="orders_manager">Orders manager</option>
              <option value="support">Support</option>
            </select>
          </label>
          <div className="admin-permission-field">
            <span className="admin-field-label">Akses yang diizinkan</span>
            <div className="admin-permission-grid">
              {ADMIN_PERMISSION_KEYS.map((permission) => (
                <label className="admin-check" key={permission}>
                  <input name={`permission_${permission}`} type="checkbox" defaultChecked={permission === 'orders' || permission === 'notifications'} />
                  {permissionLabels[permission]}
                </label>
              ))}
            </div>
          </div>
          <div className="admin-membership-form-foot">
            <p className={state.message ? (state.ok ? 'action-success' : 'action-error') : 'admin-form-note'}>{state.message || 'Perubahan akan langsung berlaku setelah disimpan.'}</p>
            <button className="button button-dark" type="submit" disabled={pending}>{pending ? 'Menyimpan...' : 'Simpan akses'}</button>
          </div>
        </form>
      </section>

      <section className="admin-panel">
        <div className="panel-heading">
          <div><p className="eyebrow">Team access</p><h3>Admin yang terdaftar</h3></div>
          <span className="notification-count">{memberships.length} akun</span>
        </div>
        {memberships.length === 0 ? <p className="admin-empty-copy">Belum ada admin selain owner.</p> : memberships.map((membership) => <AdminMembershipRow key={membership.user_id} membership={membership} />)}
      </section>
    </div>
  );
}

function AdminMembershipRow({ membership }: { membership: AdminMembership }) {
  const [state, formAction, pending] = useActionState(setAdminMembershipStatus, initialState);
  const initials = membership.display_name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'LN';
  const permissionCount = ADMIN_PERMISSION_KEYS.filter((permission) => membership.role === 'owner' || membership.permissions?.[permission]).length;

  return (
    <div className={`admin-membership-row${membership.is_active ? '' : ' is-disabled'}`}>
      <div className="admin-membership-person">
        {membership.avatar_url ? <img src={membership.avatar_url} alt="" referrerPolicy="no-referrer" /> : <span className="account-avatar-fallback">{initials}</span>}
        <div><strong>{membership.display_name}</strong><small>{membership.email}</small></div>
      </div>
      <div className="admin-membership-meta"><b>{membership.role === 'owner' ? 'Super admin' : roleLabels[membership.role]}</b><span>{membership.role === 'owner' ? 'Semua akses' : `${permissionCount} area aktif`}</span></div>
      <div className="admin-membership-permissions">{ADMIN_PERMISSION_KEYS.filter((permission) => membership.role === 'owner' || membership.permissions?.[permission]).map((permission) => <span key={permission}>{permissionLabels[permission]}</span>)}</div>
      {membership.role === 'owner' ? <span className="admin-owner-badge">Owner</span> : <form action={formAction}><input type="hidden" name="user_id" value={membership.user_id} /><input type="hidden" name="is_active" value={membership.is_active ? 'false' : 'true'} /><button className="button button-outline admin-status-button" type="submit" disabled={pending}>{pending ? '...' : membership.is_active ? 'Nonaktifkan' : 'Aktifkan'}</button>{state.message && <small className={state.ok ? 'action-success' : 'action-error'}>{state.message}</small>}</form>}
    </div>
  );
}
