'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export interface OrganizationRow {
  id: string; name: string; type: 'azentio' | 'client'; status: 'active' | 'suspended' | 'disabled';
  active_members: number; entitlements: { id: string; offering_id: string; feature: string | null }[];
}
const field = 'rounded-xl border border-az-grey-bg bg-white px-3 py-2.5 text-sm text-az-text focus-visible:outline-2 focus-visible:outline-az-green';

export default function OrganizationManager({ organizations }: { organizations: OrganizationRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function request(url: string, method: string, body?: unknown): Promise<boolean> {
    setBusy(true); setMessage('');
    try {
      const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'The request could not be completed.');
      setMessage(result.email_status === 'queued' ? 'Organisation saved. The administrator invitation is queued for email delivery.' : 'Organisation settings saved.');
      router.refresh();
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The request could not be completed.');
      return false;
    } finally { setBusy(false); }
  }

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const values = new FormData(formElement);
    const type = String(values.get('type')) as 'client' | 'azentio';
    const payload = { name: values.get('name'), type, ...(type === 'client' ? { initial_admin_email: values.get('initial_admin_email') } : {}) };
    if (await request('/api/v1/admin/organizations', 'POST', payload)) formElement.reset();
  }

  async function grantEntitlement(event: React.FormEvent<HTMLFormElement>, orgId: string) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const values = new FormData(formElement);
    if (await request(`/api/v1/admin/organizations/${orgId}/entitlements`, 'POST', { offering_id: values.get('offering_id'), feature: 'sandbox' })) formElement.reset();
  }

  return <div className="space-y-8">
    <form onSubmit={create} className="grid gap-3 rounded-2xl border border-az-grey-bg bg-white p-5 md:grid-cols-4">
      <label className="text-sm font-medium text-az-navy">Organisation name<input name="name" required minLength={2} maxLength={160} className={`${field} mt-1.5 w-full`} /></label>
      <label className="text-sm font-medium text-az-navy">Type<select name="type" className={`${field} mt-1.5 w-full`}><option value="client">Client</option><option value="azentio">Azentio</option></select></label>
      <label className="text-sm font-medium text-az-navy">Initial client admin email<input name="initial_admin_email" type="email" className={`${field} mt-1.5 w-full`} placeholder="Required for client orgs" /></label>
      <div className="flex items-end"><button disabled={busy} className="w-full rounded-full bg-az-green px-5 py-2.5 text-sm font-semibold text-az-navy cursor-pointer active:scale-[0.96] transition-all disabled:cursor-not-allowed disabled:opacity-50">Create organisation</button></div>
      <p className="text-xs text-az-text-muted md:col-span-4">Creating a client organisation sends a single-use invitation for its first client administrator.</p>
    </form>
    {message && <p role="status" className="rounded-xl bg-az-mint-tint p-3 text-sm text-az-navy">{message}</p>}
    <div className="space-y-5">{organizations.map((org) => <section key={org.id} className="rounded-2xl border border-az-grey-bg bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold text-az-navy">{org.name}</h2><p className="mt-1 text-xs text-az-text-muted">{org.type === 'client' ? 'Client' : 'Azentio'} · {org.active_members} active members · {org.status}</p>{org.type === 'client' && <Link href={`/portal/admin/organizations/${org.id}/resources`} className="mt-2 inline-flex text-sm font-semibold text-az-navy underline underline-offset-2">Manage client resources</Link>}</div>{org.type === 'client' && <label className="flex items-center gap-2 text-sm text-az-navy">Status<select value={org.status} onChange={(event) => void request(`/api/v1/admin/organizations/${org.id}`, 'PATCH', { status: event.target.value })} className={field} disabled={busy}><option value="active">Active</option><option value="suspended">Suspended</option><option value="disabled">Disabled</option></select></label>}</div>
      {org.type === 'client' && <div className="mt-5"><p className="mb-2 text-sm font-semibold text-az-navy">Active sandbox entitlements</p><div className="flex flex-wrap gap-2">{org.entitlements.length ? org.entitlements.map((entitlement) => <span key={entitlement.id} className="inline-flex items-center gap-2 rounded-full bg-az-grey-bg px-3 py-1.5 text-xs text-az-navy">{entitlement.offering_id}<button type="button" disabled={busy} aria-label={`Revoke ${entitlement.offering_id} entitlement`} onClick={() => void request(`/api/v1/admin/entitlements/${entitlement.id}`, 'DELETE')} className="font-bold cursor-pointer hover:opacity-70 disabled:cursor-not-allowed">×</button></span>) : <span className="text-sm text-az-text-muted">None</span>}</div><form onSubmit={(event) => void grantEntitlement(event, org.id)} className="mt-3 flex flex-wrap gap-2"><select name="offering_id" className={field}><option value="FAI">FAI</option><option value="Lending">Lending</option><option value="AMLOCK">AMLOCK</option><option value="Insurance">Insurance</option></select><button disabled={busy || org.status !== 'active'} className="rounded-full border border-az-navy px-4 py-2 text-xs font-semibold text-az-navy cursor-pointer active:scale-[0.96] transition-all disabled:cursor-not-allowed disabled:opacity-50">Grant sandbox access</button></form></div>}
    </section>)}</div>
  </div>;
}
