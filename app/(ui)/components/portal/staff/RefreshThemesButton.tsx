'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function RefreshThemesButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function refresh() {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/v1/moderation/themes/refresh', { method: 'POST' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Themes could not be refreshed.');
      setMessage(`${result.data.themes} threshold-qualified themes are current.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Themes could not be refreshed.');
    } finally { setBusy(false); }
  }
  return <div className="flex flex-wrap items-center gap-3">
    <button type="button" disabled={busy} onClick={() => void refresh()} className="rounded-full border border-az-navy px-4 py-2 text-xs font-semibold text-az-navy disabled:opacity-50">{busy ? 'Refreshing…' : 'Refresh approved themes'}</button>
    {message && <span role="status" className="text-xs text-az-text-muted">{message}</span>}
  </div>;
}
