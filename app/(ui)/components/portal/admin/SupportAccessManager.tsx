'use client';

import { useState } from 'react';

type Organization = { id: string; name: string };
type PortalAdmin = { id: string; display_name: string; email: string };
type Grant = {
  id: string; org_id: string; org_name: string; portal_admin_id: string;
  portal_admin_name: string; portal_admin_email: string; reason: string;
  granted_at: string | Date; expires_at: string | Date;
  revoked_at: string | Date | null; is_active: boolean;
};

export function SupportAccessManager({ organizations, admins, initialGrants }: { organizations: Organization[]; admins: PortalAdmin[]; initialGrants: Grant[] }) {
  const [grants, setGrants] = useState(initialGrants);
  const [orgId, setOrgId] = useState('');
  const [portalAdminId, setPortalAdminId] = useState('');
  const [reason, setReason] = useState('');
  const [durationHours, setDurationHours] = useState('24');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function grant(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/v1/support-access', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portal_admin_id: portalAdminId, org_id: orgId, reason, duration_hours: Number(durationHours) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Unable to grant support access.');
      const org = organizations.find((item) => item.id === orgId);
      const admin = admins.find((item) => item.id === portalAdminId);
      setGrants((current) => [{ ...result.data, org_id: orgId, org_name: org?.name ?? 'Client organisation', portal_admin_id: portalAdminId, portal_admin_name: admin?.display_name ?? 'Portal administrator', portal_admin_email: admin?.email ?? '', reason, revoked_at: null, is_active: true }, ...current]);
      setReason(''); setMessage('Time-limited support access granted and audited.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to grant support access.'); }
    finally { setBusy(false); }
  }

  async function revoke(id: string) {
    setBusy(true); setMessage('');
    try {
      const response = await fetch(`/api/v1/support-access/${id}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Unable to revoke support access.');
      setGrants((current) => current.map((item) => item.id === id ? { ...item, revoked_at: new Date(), is_active: false } : item));
      setMessage('Support access revoked and audited.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to revoke support access.'); }
    finally { setBusy(false); }
  }

  return <section className="mb-8 rounded-2xl border border-az-grey-bg bg-white p-5 shadow-card" aria-labelledby="support-access-title">
    <h2 id="support-access-title" className="text-lg font-semibold text-az-navy">Temporary support access</h2>
    <p className="mt-1 text-sm text-az-text-muted">Grant an active global portal administrator organisation-wide ticket access for a specific support reason. Access expires within 72 hours and can be revoked early.</p>
    <form onSubmit={grant} className="mt-4 grid gap-3 md:grid-cols-2">
      <label className="text-sm font-semibold text-az-navy">Portal administrator<select required value={portalAdminId} onChange={(event) => setPortalAdminId(event.target.value)} className="mt-1 w-full rounded-xl border border-az-grey-bg bg-white px-4 py-2.5 font-normal"><option value="">Select an administrator</option>{admins.map((admin) => <option key={admin.id} value={admin.id}>{admin.display_name} · {admin.email}</option>)}</select></label>
      <label className="text-sm font-semibold text-az-navy">Client organisation<select required value={orgId} onChange={(event) => setOrgId(event.target.value)} className="mt-1 w-full rounded-xl border border-az-grey-bg bg-white px-4 py-2.5 font-normal"><option value="">Select an organisation</option>{organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}</select></label>
      <label className="text-sm font-semibold text-az-navy">Duration<select value={durationHours} onChange={(event) => setDurationHours(event.target.value)} className="mt-1 w-full rounded-xl border border-az-grey-bg bg-white px-4 py-2.5 font-normal"><option value="1">1 hour</option><option value="24">24 hours</option><option value="48">48 hours</option><option value="72">72 hours</option></select></label>
      <label className="text-sm font-semibold text-az-navy md:col-span-2">Reason for access<textarea required minLength={10} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 min-h-20 w-full rounded-xl border border-az-grey-bg px-4 py-2.5 font-normal" /></label>
      <button type="submit" disabled={busy || organizations.length === 0 || admins.length === 0} className="w-fit rounded-full bg-az-navy px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">Grant temporary access</button>
    </form>
    {grants.length > 0 && <ul className="mt-5 space-y-2">{grants.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-az-grey-bg/50 p-3 text-sm"><div><p className="font-semibold text-az-navy">{item.portal_admin_name} · {item.org_name} · {item.is_active ? 'Active' : item.revoked_at ? 'Revoked' : 'Expired'}</p><p className="mt-1 text-xs text-az-text-muted">{item.reason} · Expires {new Date(item.expires_at).toLocaleString()}</p></div>{item.is_active && <button type="button" disabled={busy} onClick={() => void revoke(item.id)} className="rounded-full border border-az-grey-bg bg-white px-4 py-2 text-xs font-semibold text-az-navy disabled:opacity-50">Revoke</button>}</li>)}</ul>}
    {message && <p role="status" className="mt-3 text-sm text-az-text-muted">{message}</p>}
  </section>;
}
