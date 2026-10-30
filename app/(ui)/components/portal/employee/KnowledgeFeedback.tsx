'use client';

import { useState } from 'react';

export default function KnowledgeFeedback({ itemId, initialHelpful, initialNote, resource = 'knowledge', question = 'Was this guide useful?' }: {
  itemId: string; initialHelpful: boolean | null; initialNote: string;
  /** Which employee feedback endpoint to use. */
  resource?: 'knowledge' | 'experiments'; question?: string;
}) {
  const [helpful, setHelpful] = useState(initialHelpful);
  const [note, setNote] = useState(initialNote);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    if (helpful === null) { setMessage('Choose helpful or needs improvement first.'); return; }
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`/api/v1/employee/${resource}/${itemId}/feedback`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ helpful, note }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Feedback could not be saved.');
      setMessage('Feedback saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Feedback could not be saved.');
    } finally { setBusy(false); }
  }

  return <div className="mt-5 border-t border-az-grey-bg pt-4">
    <p className="text-sm font-semibold text-az-navy">{question}</p>
    <div className="mt-2 flex gap-2">
      <button type="button" aria-pressed={helpful === true} onClick={() => setHelpful(true)} className={`rounded-full border px-4 py-2 text-xs font-semibold cursor-pointer active:scale-95 transition-all ${helpful === true ? 'border-az-navy bg-az-mint-tint text-az-navy' : 'border-az-grey-bg text-az-text'}`}>Helpful</button>
      <button type="button" aria-pressed={helpful === false} onClick={() => setHelpful(false)} className={`rounded-full border px-4 py-2 text-xs font-semibold cursor-pointer active:scale-95 transition-all ${helpful === false ? 'border-az-navy bg-az-mint-tint text-az-navy' : 'border-az-grey-bg text-az-text'}`}>Needs improvement</button>
    </div>
    <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} rows={2} aria-label="Optional feedback" placeholder="Optional note" className="mt-3 w-full rounded-xl border border-az-grey-bg px-3 py-2 text-sm" />
    <div className="mt-2 flex items-center gap-3"><button type="button" disabled={busy} onClick={save} className="rounded-full bg-az-green px-4 py-2 text-xs font-semibold text-az-navy cursor-pointer active:scale-[0.96] transition-all disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Saving…' : 'Save feedback'}</button>{message && <p role="status" className="text-xs text-az-text-muted">{message}</p>}</div>
  </div>;
}
