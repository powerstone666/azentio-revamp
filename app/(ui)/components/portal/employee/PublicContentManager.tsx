'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export type PublicContentRow = {
  id: string; kind: 'announcement' | 'page'; slug: string | null; title: string; body: string;
  link_label: string | null; link_href: string | null; status: 'draft' | 'published' | 'archived';
  starts_at: string | null; ends_at: string | null; published_at: string | null; updated_at: string;
};

type Draft = Omit<PublicContentRow, 'id' | 'published_at' | 'updated_at'>;
const EMPTY: Draft = { kind: 'announcement', slug: null, title: '', body: '', link_label: null, link_href: null, status: 'draft', starts_at: null, ends_at: null };
const field = 'w-full rounded-xl border border-az-grey-bg bg-white px-3 py-2.5 text-sm text-az-text focus-visible:outline-2 focus-visible:outline-az-green';

function toLocalInput(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default function PublicContentManager({ initialItems }: { initialItems: PublicContentRow[] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  function edit(item: PublicContentRow) {
    setSelectedId(item.id);
    setDraft({ kind: item.kind, slug: item.slug, title: item.title, body: item.body, link_label: item.link_label,
      link_href: item.link_href, status: item.status, starts_at: item.starts_at, ends_at: item.ends_at });
    setMessage('');
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const kind = String(values.get('kind')) as Draft['kind'];
    const linkLabel = String(values.get('link_label') ?? '').trim();
    const linkHref = String(values.get('link_href') ?? '').trim();
    const startsAt = String(values.get('starts_at') ?? '');
    const endsAt = String(values.get('ends_at') ?? '');
    const content: Draft = {
      kind,
      slug: kind === 'page' ? String(values.get('slug') ?? '').trim() : null,
      title: String(values.get('title') ?? '').trim(),
      body: String(values.get('body') ?? '').trim(),
      link_label: linkLabel || null,
      link_href: linkHref || null,
      status: String(values.get('status')) as Draft['status'],
      starts_at: startsAt ? new Date(startsAt).toISOString() : null,
      ends_at: endsAt ? new Date(endsAt).toISOString() : null,
    };
    setBusy(true); setMessage('');
    try {
      const response = await fetch(selectedId ? `/api/v1/publisher/content/${selectedId}` : '/api/v1/publisher/content', {
        method: selectedId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(content),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Could not save public content.');
      setMessage(content.status === 'published' ? 'Published changes saved.' : 'Draft saved.');
      setSelectedId(String(result.data.id));
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save public content.');
    } finally { setBusy(false); }
  }

  const set = (key: keyof Draft, value: string | null) => setDraft((current) => ({ ...current, [key]: value }));
  const label = (item: PublicContentRow) => item.kind === 'page' ? `/content?slug=${item.slug}` : 'Public announcement';

  return <div className="space-y-8">
    <div className="flex flex-wrap gap-3">
      <button type="button" onClick={() => { setSelectedId(null); setDraft({ ...EMPTY }); setMessage(''); }} className="cursor-pointer rounded-full bg-az-green px-5 py-2.5 text-sm font-semibold text-az-navy transition-all duration-150 hover:brightness-105 active:scale-[0.96] ease-[cubic-bezier(0.34,1.56,0.64,1)]">New announcement</button>
      <button type="button" onClick={() => { setSelectedId(null); setDraft({ ...EMPTY, kind: 'page' }); setMessage(''); }} className="cursor-pointer rounded-full border border-az-grey-bg px-5 py-2.5 text-sm font-semibold text-az-navy transition-all duration-150 hover:bg-az-grey-bg active:scale-[0.96] ease-[cubic-bezier(0.34,1.56,0.64,1)]">New public page</button>
    </div>
    <form onSubmit={(event) => void save(event)} className="grid gap-4 rounded-2xl border border-az-grey-bg bg-white p-5 md:grid-cols-2">
      <label className="text-sm font-medium text-az-navy">Type<select name="kind" value={draft.kind} onChange={(event) => { const kind = event.target.value as Draft['kind']; setDraft((current) => ({ ...current, kind, slug: kind === 'page' ? current.slug : null })); }} className={`${field} mt-1.5`}><option value="announcement">Announcement banner</option><option value="page">Public page</option></select></label>
      {draft.kind === 'page' && <label className="text-sm font-medium text-az-navy">URL slug<input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={100} value={draft.slug ?? ''} onChange={(event) => set('slug', event.target.value)} placeholder="company-update" className={`${field} mt-1.5`} /><span className="mt-1 block text-xs text-az-text-muted">Public address: /content?slug={draft.slug || 'your-slug'}</span></label>}
      <label className="text-sm font-medium text-az-navy">Title<input name="title" required minLength={3} maxLength={160} value={draft.title} onChange={(event) => set('title', event.target.value)} className={`${field} mt-1.5`} /></label>
      <label className="text-sm font-medium text-az-navy md:col-span-2">Body<textarea name="body" required maxLength={draft.kind === 'announcement' ? 400 : 10000} rows={draft.kind === 'announcement' ? 3 : 10} value={draft.body} onChange={(event) => set('body', event.target.value)} className={`${field} mt-1.5`} /><span className="mt-1 block text-xs text-az-text-muted">Markdown is supported on public pages; raw HTML is not rendered.</span></label>
      <label className="text-sm font-medium text-az-navy">Link label (optional)<input name="link_label" maxLength={60} value={draft.link_label ?? ''} onChange={(event) => set('link_label', event.target.value)} className={`${field} mt-1.5`} /></label>
      <label className="text-sm font-medium text-az-navy">Destination (internal path or HTTPS)<input name="link_href" type="text" maxLength={2048} value={draft.link_href ?? ''} onChange={(event) => set('link_href', event.target.value)} placeholder="/connect or https://example.com" className={`${field} mt-1.5`} /></label>
      {draft.kind === 'announcement' && <>
        <label className="text-sm font-medium text-az-navy">Show from (optional)<input name="starts_at" type="datetime-local" value={toLocalInput(draft.starts_at)} onChange={(event) => set('starts_at', event.target.value ? new Date(event.target.value).toISOString() : null)} className={`${field} mt-1.5`} /></label>
        <label className="text-sm font-medium text-az-navy">Hide after (optional)<input name="ends_at" type="datetime-local" value={toLocalInput(draft.ends_at)} onChange={(event) => set('ends_at', event.target.value ? new Date(event.target.value).toISOString() : null)} className={`${field} mt-1.5`} /></label>
      </>}
      <label className="text-sm font-medium text-az-navy">Status<select name="status" value={draft.status} onChange={(event) => set('status', event.target.value)} className={`${field} mt-1.5`}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label>
      <div className="flex items-end"><button type="submit" disabled={busy} className="cursor-pointer rounded-full bg-az-navy px-5 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-az-navy/90 active:scale-[0.96] ease-[cubic-bezier(0.34,1.56,0.64,1)] disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Saving…' : selectedId ? 'Save changes' : 'Create content'}</button></div>
      {message && <p role="status" className="text-sm text-az-text-muted md:col-span-2">{message}</p>}
    </form>
    <section><h2 className="mb-3 text-lg font-semibold text-az-navy">Managed content</h2>{initialItems.length === 0 ? <p className="text-sm text-az-text-muted">No publisher-managed public content yet.</p> : <ul className="space-y-3">{initialItems.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-az-grey-bg bg-white p-4"><div><div className="flex items-center gap-2"><span className="rounded-full bg-az-grey-bg px-3 py-1 text-xs font-semibold capitalize text-az-navy">{item.status}</span><span className="text-xs text-az-text-muted">{item.kind}</span></div><p className="mt-2 font-semibold text-az-navy">{item.title}</p><p className="mt-1 text-xs text-az-text-muted">{label(item)} · Updated {new Date(item.updated_at).toLocaleString()}</p></div><button type="button" onClick={() => edit(item)} className="cursor-pointer rounded-full border border-az-grey-bg px-4 py-2 text-sm font-semibold text-az-navy transition-all duration-150 hover:bg-az-grey-bg active:scale-[0.96] ease-[cubic-bezier(0.34,1.56,0.64,1)]">Edit</button></li>)}</ul>}</section>
  </div>;
}
