'use client';

import { useState } from 'react';

export function ReportStatusControl({ id, status, endpoint = '/api/v1/moderation/reports' }: { id: string; status: string; endpoint?: string }) {
  const [currentStatus, setCurrentStatus] = useState(status);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function update(nextStatus: 'investigating' | 'resolved') {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`${endpoint}/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: nextStatus }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Report status could not be updated.');
      setCurrentStatus(result.data.status);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Report status could not be updated.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="flex flex-wrap items-center gap-2">
    <span className="capitalize">{currentStatus}</span>
    {currentStatus !== 'resolved' && <>
      {currentStatus === 'open' && <button type="button" disabled={busy} onClick={() => void update('investigating')} className="rounded-full border border-az-grey-bg px-3 py-1 text-xs font-semibold text-az-navy disabled:opacity-50">Investigate</button>}
      <button type="button" disabled={busy} onClick={() => void update('resolved')} className="rounded-full bg-az-green px-3 py-1 text-xs font-semibold text-az-navy disabled:opacity-50">Resolve</button>
    </>}
    {message && <span role="status" className="basis-full text-xs text-az-error">{message}</span>}
  </div>;
}
