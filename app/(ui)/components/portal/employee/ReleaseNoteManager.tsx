'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export interface ManagedReleaseNote {
  id: string; title: string; body: string; audience: 'employees' | 'clients';
  offering_id: string | null; org_name: string | null; status: 'draft' | 'published' | 'archived';
  published_at: string | null;
}

const field = 'w-full rounded-xl border border-az-grey-bg bg-white px-3 py-2.5 text-sm text-az-text focus-visible:outline-2 focus-visible:outline-az-green';

export function ReleaseNoteManager({ offerings, canPublishAll, initialNotes }: {
  offerings: string[]; canPublishAll: boolean; initialNotes: ManagedReleaseNote[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function send(url: string, method: string, body?: unknown) {
    setBusy(true); setMessage('');
    try {
      const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? 'Release note could not be saved.');
      setMessage('Release note updated.'); router.refresh();
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Release note could not be saved.');
      return false;
    } finally { setBusy(false); }
  }

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const created = await send('/api/v1/release-notes', 'POST', {
      title: values.get('title'), body: values.get('body'), audience: values.get('audience'),
      offering_id: values.get('offering_id') || null, org_id: null,
    });
    if (created) form.reset();
  }

  async function saveDraft(event: React.FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    await send(`/api/v1/release-notes/${id}`, 'PATCH', { title: values.get('title'), body: values.get('body') });
  }

  return <section className="space-y-5">
    <form onSubmit={(event) => void create(event)} className="grid gap-4 rounded-2xl border border-az-grey-bg bg-white p-5">
      <h2 className="text-lg font-semibold text-az-navy">Create release note draft</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium text-az-navy">Audience<select name="audience" className={`${field} mt-1.5`}><option value="employees">Employees</option><option value="clients">Clients</option></select></label>
        <label className="text-sm font-medium text-az-navy">Offering{!canPublishAll && <span aria-hidden="true"> *</span>}<select name="offering_id" required={!canPublishAll} className={`${field} mt-1.5`}><option value="">{canPublishAll ? 'All offerings' : 'Choose assigned offering'}</option>{offerings.map((offering) => <option key={offering} value={offering}>{offering}</option>)}</select></label>
      </div>
      <label className="text-sm font-medium text-az-navy">Title<input name="title" required minLength={3} maxLength={200} className={`${field} mt-1.5`} /></label>
      <label className="text-sm font-medium text-az-navy">Update<textarea name="body" required minLength={10} maxLength={10000} rows={5} className={`${field} mt-1.5`} /></label>
      <p className="text-xs text-az-text-muted">Client notes are visible only to active client workspaces, and offering scoped notes require an active entitlement. Drafts are not visible to clients.</p>
      <button disabled={busy} className="w-fit rounded-full bg-az-green px-5 py-2.5 text-sm font-semibold text-az-navy disabled:opacity-50">Save draft</button>
    </form>
    {message && <p role="status" className="text-sm text-az-text-muted">{message}</p>}
    <div className="space-y-4">{initialNotes.map((note) => <form key={note.id} onSubmit={(event) => void saveDraft(event, note.id)} className="space-y-3 rounded-2xl border border-az-grey-bg bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold text-az-navy">{note.title}</h3><p className="mt-1 text-xs capitalize text-az-text-muted">{note.audience} · {note.offering_id ?? 'all offerings'}{note.org_name ? ` · ${note.org_name}` : ''} · {note.status}</p></div>{note.status === 'draft' && <button type="button" disabled={busy} onClick={() => void send(`/api/v1/release-notes/${note.id}/publish`, 'POST')} className="rounded-full bg-az-green px-4 py-2 text-xs font-semibold text-az-navy disabled:opacity-50">Publish</button>}{note.status !== 'archived' && <button type="button" disabled={busy} onClick={() => void send(`/api/v1/release-notes/${note.id}/archive`, 'POST')} className="rounded-full border border-az-grey-bg px-4 py-2 text-xs font-semibold text-az-navy disabled:opacity-50">Archive</button>}</div>
      {note.status === 'draft' ? <><input name="title" defaultValue={note.title} required minLength={3} maxLength={200} className={field} /><textarea name="body" defaultValue={note.body} required minLength={10} maxLength={10000} rows={4} className={field} /><button disabled={busy} className="rounded-full border border-az-navy px-4 py-2 text-xs font-semibold text-az-navy disabled:opacity-50">Save changes</button></> : <p className="whitespace-pre-wrap text-sm leading-relaxed text-az-text">{note.body}</p>}
    </form>)}</div>
  </section>;
}
