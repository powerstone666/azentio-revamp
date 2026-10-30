'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export interface ClientResourceRow {
  id: string; title: string; description: string; category: string; resource_url: string;
  offering_id: string | null; status: 'active' | 'archived';
}

const field = 'w-full rounded-xl border border-az-grey-bg bg-white px-3 py-2.5 text-sm text-az-text focus-visible:outline-2 focus-visible:outline-az-green';

export function ClientResourceManager({ orgId, offerings, initialResources }: {
  orgId: string; offerings: string[]; initialResources: ClientResourceRow[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true); setMessage('');
    try {
      const response = await fetch(`/api/v1/admin/organizations/${orgId}/resources`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: values.get('title'), description: values.get('description'),
          category: values.get('category'), resource_url: values.get('resource_url'),
          offering_id: values.get('offering_id') || null,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Could not create this resource.');
      form.reset(); setMessage('Resource saved for this client workspace.'); router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not create this resource.');
    } finally { setBusy(false); }
  }

  async function archive(resourceId: string) {
    setBusy(true); setMessage('');
    try {
      const response = await fetch(`/api/v1/admin/organizations/${orgId}/resources/${resourceId}`, { method: 'DELETE' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? 'Could not archive this resource.');
      setMessage('Resource archived.'); router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not archive this resource.');
    } finally { setBusy(false); }
  }

  const active = initialResources.filter((item) => item.status === 'active');
  const archived = initialResources.filter((item) => item.status === 'archived');
  return <div className="space-y-8">
    <form onSubmit={(event) => void submit(event)} className="grid gap-4 rounded-2xl border border-az-grey-bg bg-white p-5 md:grid-cols-2">
      <label className="text-sm font-medium text-az-navy">Title<input name="title" required minLength={3} maxLength={180} className={`${field} mt-1.5`} /></label>
      <label className="text-sm font-medium text-az-navy">Category<input name="category" required maxLength={80} placeholder="Getting started" className={`${field} mt-1.5`} /></label>
      <label className="text-sm font-medium text-az-navy md:col-span-2">Description<textarea name="description" maxLength={3000} rows={3} className={`${field} mt-1.5`} /></label>
      <label className="text-sm font-medium text-az-navy md:col-span-2">HTTPS resource link<input name="resource_url" type="url" required pattern="https://.*" maxLength={2048} placeholder="https://…" className={`${field} mt-1.5`} /></label>
      <label className="text-sm font-medium text-az-navy">Offering access<select name="offering_id" className={`${field} mt-1.5`}><option value="">All members of this organisation</option>{offerings.map((offering) => <option key={offering} value={offering}>{offering} entitled members</option>)}</select></label>
      <div className="flex items-end"><button type="submit" disabled={busy} className="rounded-full bg-az-green px-5 py-2.5 text-sm font-semibold text-az-navy disabled:opacity-50">Add resource</button></div>
    </form>
    {message && <p role="status" className="text-sm text-az-text-muted">{message}</p>}
    <section><h2 className="mb-3 text-lg font-semibold text-az-navy">Active resources</h2>{active.length === 0 ? <p className="text-sm text-az-text-muted">No active resources.</p> : <ul className="space-y-3">{active.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-az-grey-bg bg-white p-4"><div><p className="font-semibold text-az-navy">{item.title}</p><p className="mt-1 text-xs text-az-text-muted">{item.category}{item.offering_id ? ` · ${item.offering_id}` : ' · all workspace members'}</p><p className="mt-1 max-w-2xl truncate text-xs text-az-text-muted">{item.resource_url}</p></div><button type="button" disabled={busy} onClick={() => void archive(item.id)} className="rounded-full border border-az-error px-4 py-2 text-xs font-semibold text-az-error disabled:opacity-50">Archive</button></li>)}</ul>}</section>
    {archived.length > 0 && <section><h2 className="mb-3 text-lg font-semibold text-az-navy">Archived</h2><ul className="space-y-2">{archived.map((item) => <li key={item.id} className="rounded-xl bg-az-grey-bg/50 p-3 text-sm text-az-text-muted">{item.title} · {item.category}</li>)}</ul></section>}
  </div>;
}
