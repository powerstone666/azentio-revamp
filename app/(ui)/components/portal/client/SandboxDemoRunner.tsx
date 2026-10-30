'use client';

import { useState } from 'react';
import type { SandboxDemo } from '@/app/(config)/sandbox';

interface RunRecord {
  id: string;
  created_at: string | Date;
  output_snapshot: SandboxDemo['scenarioOutput'];
}

export function SandboxDemoRunner({ demo, initialRuns }: { demo: SandboxDemo; initialRuns: RunRecord[] }) {
  const [runs, setRuns] = useState(initialRuns);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/v1/demos/${encodeURIComponent(demo.id)}/runs`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario_key: demo.scenarioKey }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'The sandbox could not run.');
      setRuns((current) => [result.data, ...current].slice(0, 10));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The sandbox could not run.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="space-y-6">
    <section className="rounded-2xl border border-az-grey-bg p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-az-text-muted">Synthetic scenario</p>
      <h2 className="mt-2 text-lg font-semibold text-az-navy">{demo.scenarioTitle}</h2>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        {Object.entries(demo.scenarioInput).map(([key, value]) => <div key={key}><dt className="text-xs capitalize text-az-text-muted">{key.replaceAll('_', ' ')}</dt><dd className="text-sm font-medium text-az-navy">{String(value)}</dd></div>)}
      </dl>
      <button type="button" onClick={() => void run()} disabled={busy} className="mt-5 rounded-full bg-az-green px-5 py-2.5 text-sm font-semibold text-az-navy cursor-pointer active:scale-[0.96] transition-all disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Running…' : 'Run synthetic scenario'}</button>
      {error && <p role="alert" className="mt-3 text-sm text-az-error">{error}</p>}
      <p className="mt-3 text-xs text-az-text-muted">Deterministic synthetic output. No customer data is uploaded or used, and this is not a business decision.</p>
    </section>

    <section aria-labelledby="sandbox-runs-heading">
      <h2 id="sandbox-runs-heading" className="mb-3 text-base font-semibold text-az-navy">Your recent runs</h2>
      {runs.length === 0 ? <p className="text-sm text-az-text-muted">No runs saved for this workspace and user.</p> : <ul className="space-y-3">
        {runs.map((item) => <li key={item.id} className="rounded-2xl border border-az-grey-bg p-4"><p className="text-sm font-semibold text-az-navy">{item.output_snapshot.summary}</p><time className="mt-1 block text-xs text-az-text-muted" dateTime={new Date(item.created_at).toISOString()}>{new Date(item.created_at).toLocaleString()}</time></li>)}
      </ul>}
    </section>
  </div>;
}
