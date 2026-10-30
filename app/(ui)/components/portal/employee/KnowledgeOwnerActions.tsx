'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
const BUTTON = 'cursor-pointer rounded-full border border-az-navy px-4 py-2 text-xs font-semibold text-az-navy transition-all active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50';

/** Owner-only controls: publish a draft, mark a guide as reviewed (review date +90 days), or archive it. */
export default function KnowledgeOwnerActions({ itemId, status }: { itemId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function patch(body: Record<string, string>, done: string) {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`/api/v1/employee/knowledge/${itemId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'The change could not be saved.');
      setMessage(done);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The change could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-az-grey-bg pt-4">
    {status === 'draft' && <button type="button" disabled={busy} className={BUTTON} onClick={() => void patch({ status: 'published' }, 'Published.')}>Publish</button>}
    {status === 'published' && <button type="button" disabled={busy} className={BUTTON} onClick={() => void patch({ review_at: inDays(90) }, 'Marked as reviewed. Next review in 90 days.')}>Mark reviewed</button>}
    <button type="button" disabled={busy} className={`${BUTTON} border-az-error text-az-error`} onClick={() => void patch({ status: 'archived' }, 'Archived.')}>Archive</button>
    {message && <p role="status" className="text-xs text-az-text-muted">{message}</p>}
  </div>;
}
