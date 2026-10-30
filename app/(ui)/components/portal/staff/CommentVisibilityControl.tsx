'use client';

import { useState } from 'react';

export function CommentVisibilityControl({ id, status }: { id: string; status: string }) {
  const [current, setCurrent] = useState(status);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function update(next: 'visible' | 'hidden') {
    setBusy(true); setMessage('');
    try {
      const response = await fetch(`/api/v1/moderation/comments/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: next }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Comment visibility could not be updated.');
      setCurrent(result.data.status);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Comment visibility could not be updated.'); }
    finally { setBusy(false); }
  }
  return <div className="flex flex-wrap items-center gap-2"><span className="capitalize">{current}</span><button type="button" disabled={busy || current === 'hidden'} onClick={() => void update('hidden')} className="rounded-full border border-az-grey-bg px-3 py-1 text-xs font-semibold text-az-navy disabled:opacity-50">Hide</button><button type="button" disabled={busy || current === 'visible'} onClick={() => void update('visible')} className="rounded-full border border-az-grey-bg px-3 py-1 text-xs font-semibold text-az-navy disabled:opacity-50">Restore</button>{message && <span role="status" className="basis-full text-xs text-az-error">{message}</span>}</div>;
}
