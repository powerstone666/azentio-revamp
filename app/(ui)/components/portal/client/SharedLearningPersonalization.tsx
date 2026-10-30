'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { SavedSearchCreateInput } from '@/app/(common-lib)/types/schemas';

type SearchItem = { id: string; name: string; filters: Record<string, unknown>; digest_enabled: boolean };

function searchHref(filters: SearchItem['filters']) {
  const params = new URLSearchParams();
  for (const key of ['q', 'offering', 'industry', 'region', 'period_start', 'period_end', 'topic'] as const) {
    const value = filters[key];
    if (value) params.set(key, String(value));
  }
  return `/portal/client/shared-learning?${params.toString()}`;
}

export function SharedLearningPersonalization({ filters, initialSearches }: {
  filters: SavedSearchCreateInput['filters']; initialSearches: SearchItem[];
}) {
  const [searches, setSearches] = useState(initialSearches);
  const [name, setName] = useState('');
  const [digestEnabled, setDigestEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/search/saved', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, filters, digest_enabled: digestEnabled }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Unable to save search.');
      setSearches((current) => [result.data, ...current.filter((search) => search.id !== result.data.id)]);
      setName('');
      setMessage('Search saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save search.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`/api/v1/search/saved/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Unable to delete saved search.');
      setSearches((current) => current.filter((search) => search.id !== id));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to delete saved search.');
    } finally {
      setBusy(false);
    }
  }

  return <section aria-label="Saved searches" className="mt-6 rounded-[12px] border border-az-grey-bg bg-white p-5">
    <h2 className="text-sm font-semibold text-az-navy">Saved searches</h2>
    <form onSubmit={(event) => void save(event)} className="mt-3 flex flex-wrap gap-3">
      <label className="sr-only" htmlFor="saved-search-name">Name this search</label>
      <input id="saved-search-name" required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="Name this search" className="min-w-0 flex-1 rounded-full border border-az-grey-bg px-4 py-2 text-sm" />
      <label className="flex items-center gap-2 text-sm text-az-text"><input type="checkbox" checked={digestEnabled} onChange={(event) => setDigestEnabled(event.target.checked)} className="cursor-pointer accent-az-navy" />Email me a weekly digest</label>
      <button type="submit" disabled={busy} className="rounded-full bg-az-navy px-5 py-2 text-sm font-semibold text-white cursor-pointer active:scale-[0.96] transition-all disabled:cursor-not-allowed disabled:opacity-50">Save current filters</button>
    </form>
    {searches.length > 0 && <ul className="mt-4 flex flex-wrap gap-3">{searches.map((search) => <li key={search.id} className="flex items-center gap-2 rounded-full bg-az-grey-bg/70 py-1 pl-4 pr-2 text-sm"><Link href={searchHref(search.filters)} className="font-medium text-az-navy underline-offset-4 hover:underline">{search.name}</Link>{search.digest_enabled && <span className="text-[10px] text-az-text-muted">Weekly digest</span>}<button type="button" disabled={busy} onClick={() => void remove(search.id)} aria-label={`Delete saved search ${search.name}`} className="rounded-full px-2 py-1 text-xs text-az-text-muted hover:bg-white cursor-pointer active:scale-95 transition-all disabled:cursor-not-allowed">Remove</button></li>)}</ul>}
    {message && <p role="status" className="mt-3 text-xs text-az-text-muted">{message}</p>}
  </section>;
}

export function BookmarkButton({ sharedCopyId, initialBookmarked }: { sharedCopyId: string; initialBookmarked: boolean }) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function toggle() {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`/api/v1/shared-copies/${sharedCopyId}/bookmark`, { method: bookmarked ? 'DELETE' : 'PUT' });
      const result = response.status === 204 ? null : await response.json();
      if (!response.ok) throw new Error(result?.error ?? 'Unable to update bookmark.');
      setBookmarked(!bookmarked);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to update bookmark.');
    } finally {
      setBusy(false);
    }
  }

  return <span className="inline-flex flex-col items-start gap-1"><button type="button" disabled={busy} aria-pressed={bookmarked} onClick={() => void toggle()} className="rounded-full border border-az-navy px-5 py-2 text-sm font-semibold text-az-navy cursor-pointer active:scale-[0.96] transition-all disabled:cursor-not-allowed disabled:opacity-50">{bookmarked ? 'Remove bookmark' : 'Bookmark'}</button>{message && <span role="status" className="text-xs text-az-text-muted">{message}</span>}</span>;
}
