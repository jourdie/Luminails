'use client';

import { useActionState } from 'react';
import { setAdminMembershipStatus, upsertAdminMembership, type AdminActionState } from '../app/admin/actions';
import type { AdminMembership } from '../lib/admin';

const ACCESS_MODULES = [
  { key: 'overview', label: 'Ringkasan', permission: null },
  { key: 'brands', label: 'Brand register', permission: 'packages' },
  { key: 'catalog', label: 'SKU list', permission: 'catalog' },
  { key: 'packages', label: 'Packages', permission: 'packages' },
  { key: 'inventory', label: 'Inventory', permission: 'inventory' },
  { key: 'pricing', label: 'B2B Tier', permission: 'pricing' },
  { key: 'promotions', label: 'Promosi', permission: 'promotions' },
  { key: 'orders', label: 'Transaksi', permission: 'orders' },
  { key: 'settings', label: 'WhatsApp', permission: 'settings' },
] as const;


const initialState: AdminActionState = { ok: false, message: '' };

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
        <p className="admin-help-copy">Email harus sudah pernah login dengan Google di aplikasi. Pilih role sebagai titik awal, lalu sesuaikan akses modul di bawah. Ringkasan selalu tersedia; Brand register dan Packages masih berbagi satu permission.</p>
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
            <span className="admin-field-label">Akses modul</span>
            <div className="admin-permission-grid">
              {ACCESS_MODULES.map((module) => module.permission ? (
                <label className="admin-check" key={module.key}>
                  <input name={`permission_${module.key}`} type="checkbox" defaultChecked={module.key === 'orders'} />
                  {module.label}
                </label>
              ) : (
                <label className="admin-check is-always-on" key={module.key}>
                  <input type="checkbox" checked readOnly disabled />
                  {module.label}
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
  const [editState, editFormAction, editPending] = useActionState(upsertAdminMembership, initialState);
  const initials = membership.display_name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'LN';
  const enabledModules = ACCESS_MODULES.filter((module) => membership.role === 'owner' || module.permission === null || membership.permissions?.[module.permission]);
  const permissionCount = enabledModules.length;

  return (
    <div className={`admin-membership-row${membership.is_active ? '' : ' is-disabled'}`}>
      <div className="admin-membership-person">
        {membership.avatar_url ? <img src={membership.avatar_url} alt="" referrerPolicy="no-referrer" /> : <span className="account-avatar-fallback">{initials}</span>}
        <div><strong>{membership.display_name}</strong><small>{membership.email}</small></div>
      </div>
      <div className="admin-membership-meta"><b>{membership.role === 'owner' ? 'Super admin' : roleLabels[membership.role]}</b><span>{membership.role === 'owner' ? 'Semua akses' : `${permissionCount} area aktif`}</span></div>
      <div className="admin-membership-permissions">{enabledModules.map((module) => <span key={module.key}>{module.label}</span>)}</div>
      {membership.role === 'owner' ? <span className="admin-owner-badge">Owner</span> : <div className="admin-membership-actions">
        {membership.is_active && <details className="admin-membership-edit">
          <summary className="button button-outline">Edit akses</summary>
          <form className="admin-membership-edit-form" action={editFormAction}>
            <input type="hidden" name="email" value={membership.email ?? ''} />
            <label>Role<select name="role" defaultValue={membership.role}>{Object.entries(roleLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
            <div className="admin-permission-field"><span className="admin-field-label">Modul yang boleh dibuka</span><div className="admin-permission-grid">{ACCESS_MODULES.map((module) => module.permission ? <label className="admin-check" key={module.key}><input name={`permission_${module.key}`} type="checkbox" defaultChecked={Boolean(membership.permissions?.[module.permission])} />{module.label}</label> : <label className="admin-check is-always-on" key={module.key}><input type="checkbox" checked readOnly disabled />{module.label}</label>)}</div></div>
            <div className="admin-membership-edit-foot"><small className={editState.message ? (editState.ok ? 'action-success' : 'action-error') : 'admin-form-note'}>{editState.message || 'Centang modul yang boleh diakses user ini.'}</small><button className="button button-dark" type="submit" disabled={editPending || !membership.email}>{editPending ? 'Menyimpan...' : 'Simpan akses'}</button></div>
          </form>
        </details>}
        <form className="admin-membership-status-form" action={formAction}><input type="hidden" name="user_id" value={membership.user_id} /><input type="hidden" name="is_active" value={membership.is_active ? 'false' : 'true'} /><button className="button button-outline admin-status-button" type="submit" disabled={pending}>{pending ? '...' : membership.is_active ? 'Nonaktifkan' : 'Aktifkan'}</button>{state.message && <small className={state.ok ? 'action-success' : 'action-error'}>{state.message}</small>}</form>
      </div>}
    </div>
  );
}