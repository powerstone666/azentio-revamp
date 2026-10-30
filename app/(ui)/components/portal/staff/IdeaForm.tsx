'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export interface EvidenceOption { id: string; title: string; offering: string; theme: string }

const field = 'w-full rounded-[12px] border border-az-grey-bg bg-white px-4 py-3 text-[15px] text-az-text transition-colors duration-150 focus-visible:border-az-green focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-az-green';
const label = 'mb-1.5 block text-sm font-semibold text-az-navy';

export default function IdeaForm({ offerings, evidence }: { offerings: string[]; evidence: EvidenceOption[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [offering, setOffering] = useState(offerings[0] ?? '');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/v1/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.get('title'),
          problem_statement: form.get('problem_statement'),
          offering: form.get('offering'),
          owner_team: form.get('owner_team'),
          priority: form.get('priority'),
          audience: form.get('audience'),
          proposed_outcome: form.get('proposed_outcome'),
          client_update: form.get('client_update'),
          supporting_contribution_ids: form.getAll('evidence'),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'The idea could not be saved.');
      router.push(`/portal/product-owner/ideas/${result.data.id}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The idea could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  const scopedEvidence = evidence.filter((item) => item.offering === offering);
  return (
    <form className="space-y-6" onSubmit={submit}>
      <div className="rounded-[12px] bg-az-mint-tint px-5 py-4 text-sm font-semibold text-az-navy">An idea is not a delivery commitment.</div>
      <div><label htmlFor="idea-title" className={label}>Title</label><input id="idea-title" name="title" required minLength={3} maxLength={200} className={field} /></div>
      <div><label htmlFor="idea-problem" className={label}>Problem statement</label><textarea id="idea-problem" name="problem_statement" required minLength={10} maxLength={3000} rows={4} className={field} /></div>
      <div className="grid gap-6 md:grid-cols-2">
        <div><label htmlFor="idea-offering" className={label}>Offering</label><select id="idea-offering" name="offering" required value={offering} onChange={(event) => setOffering(event.target.value)} className={field}>{offerings.map((item) => <option key={item}>{item}</option>)}</select></div>
        <div><label htmlFor="idea-owner" className={label}>Owner team</label><input id="idea-owner" name="owner_team" maxLength={120} className={field} /></div>
        <div><label htmlFor="idea-priority" className={label}>Priority</label><select id="idea-priority" name="priority" defaultValue="medium" className={field}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></div>
        <div><label htmlFor="idea-audience" className={label}>Audience</label><select id="idea-audience" name="audience" defaultValue="internal" className={field}><option value="internal">Internal</option><option value="clients">Clients</option></select></div>
      </div>
      <fieldset><legend className={label}>Supporting approved evidence</legend>
        {scopedEvidence.length === 0 ? <p className="text-sm text-az-text-muted">No approved evidence is available for this offering yet. At least one contribution is required to create an idea.</p> : <div className="max-h-72 space-y-2 overflow-y-auto">{scopedEvidence.map((item) => <label key={item.id} className="flex items-start gap-3 rounded-[12px] border border-az-grey-bg bg-white px-4 py-3 text-sm text-az-text"><input type="checkbox" name="evidence" value={item.id} className="mt-1 h-4 w-4 accent-az-green" /><span><span className="font-semibold text-az-navy">{item.title}</span><span className="mt-1 block text-xs text-az-text-muted">Theme: {item.theme}</span></span></label>)}</div>}
      </fieldset>
      <div><label htmlFor="idea-outcome" className={label}>Proposed outcome</label><textarea id="idea-outcome" name="proposed_outcome" required minLength={10} maxLength={2000} rows={3} className={field} /></div>
      <div><label htmlFor="idea-client-update" className={label}>Client-facing update</label><textarea id="idea-client-update" name="client_update" maxLength={1000} rows={3} className={field} /><p className="mt-1.5 text-xs text-az-text-muted">Only shared when the audience is set to Clients. Keep internal planning and confidential information out.</p></div>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <div className="border-t border-az-grey-bg pt-6"><button type="submit" disabled={busy || offerings.length === 0 || scopedEvidence.length === 0} className="rounded-full bg-az-green px-6 py-3 text-sm font-semibold text-az-navy disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Saving…' : 'Create idea'}</button></div>
    </form>
  );
}
