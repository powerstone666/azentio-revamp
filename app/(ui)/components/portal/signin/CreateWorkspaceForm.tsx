'use client';

import { useState } from 'react';

const JSON_HEADERS = { 'content-type': 'application/json' };

export function CreateWorkspaceForm() {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const created = await fetch('/api/v1/workspaces/create', {
        method: 'POST', headers: JSON_HEADERS, credentials: 'include', body: JSON.stringify({ name }),
      });
      const body = await created.json().catch(() => null);
      if (!created.ok) throw new Error(body?.error ?? 'Could not create the workspace.');
      const selected = await fetch('/api/v1/workspaces', {
        method: 'POST', headers: JSON_HEADERS, credentials: 'include', body: JSON.stringify({ membership_id: body.data.membership_id }),
      });
      if (!selected.ok) throw new Error('Workspace created, but it could not be opened. Choose it from the list.');
      // Full page load: the router may hold a cached redirect for /portal.
      window.location.assign('/portal');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create the workspace.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={create} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="block flex-1 text-sm font-semibold text-az-navy">
        New workspace name
        <input
          value={name} onChange={(event) => setName(event.target.value)} required minLength={3} maxLength={80}
          placeholder="For example: Northwind Bank pilot"
          className="mt-2 block w-full rounded-xl border border-az-grey-bg px-4 py-2.5 text-[15px] font-normal text-az-text focus-visible:outline-2 focus-visible:outline-az-green"
        />
      </label>
      <button
        disabled={busy || name.trim().length < 3}
        className="inline-flex cursor-pointer items-center justify-center rounded-[50px] bg-az-navy px-6 py-2.5 text-[15px] font-semibold text-white transition-all duration-150 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:bg-az-navy/90 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? 'Creating…' : 'Create workspace'}
      </button>
      {error && <p role="alert" className="text-sm text-az-error sm:basis-full">{error}</p>}
    </form>
  );
}
