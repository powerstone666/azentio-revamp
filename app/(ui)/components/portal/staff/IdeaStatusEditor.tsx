'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IDEA_STATUSES } from './rules';

export default function IdeaStatusEditor({ ideaId, status, clientUpdate, clientVisible }: { ideaId: string; status: string; clientUpdate: string; clientVisible: boolean }) {
  const router = useRouter();
  const [nextStatus, setNextStatus] = useState(status);
  const [note, setNote] = useState('');
  const [update, setUpdate] = useState(clientUpdate);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    if (nextStatus === status && (!clientVisible || update === clientUpdate)) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/v1/ideas/${ideaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus, status_note: note, client_update: update }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'The status was not updated.');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The status was not updated.');
    } finally {
      setBusy(false);
    }
  }

  return <div>
    <label htmlFor="idea-status" className="mb-1.5 block text-sm font-semibold text-az-navy">Status</label>
    <select id="idea-status" value={nextStatus} onChange={(event) => setNextStatus(event.target.value)} className="w-full rounded-[12px] border border-az-grey-bg bg-white px-4 py-3 text-[15px] text-az-text">
      {IDEA_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
    </select>
    <label htmlFor="idea-status-note" className="mb-1.5 mt-4 block text-sm font-semibold text-az-navy">Update note</label>
    <textarea id="idea-status-note" maxLength={1000} rows={3} value={note} onChange={(event) => setNote(event.target.value)} className="w-full rounded-[12px] border border-az-grey-bg bg-white px-4 py-3 text-sm text-az-text" />
    {clientVisible && <><label htmlFor="idea-client-update" className="mb-1.5 mt-4 block text-sm font-semibold text-az-navy">Client-facing update</label><textarea id="idea-client-update" maxLength={1000} rows={4} value={update} onChange={(event) => setUpdate(event.target.value)} className="w-full rounded-[12px] border border-az-grey-bg bg-white px-4 py-3 text-sm text-az-text" /></>}
    {error && <p role="alert" className="mt-3 text-sm text-red-800">{error}</p>}
    <button type="button" onClick={save} disabled={busy || (nextStatus === status && (!clientVisible || update === clientUpdate))} className="mt-4 rounded-full bg-az-green px-5 py-2.5 text-sm font-semibold text-az-navy disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Saving…' : 'Save update'}</button>
  </div>;
}
