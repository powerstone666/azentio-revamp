'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Card } from '@/app/(ui)/components/portal/kit/ui';
import { CONSENT_ITEMS, type Consents } from './shared';
import { PreviewNote } from './PreviewNote';

export interface ObservationFormValues {
  title: string;
  type: string;
  description: string;
  offering: string;
  industry: string;
  region: string;
  periodStart: string;
  periodEnd: string;
  evidence: string;
  confidence: string;
  scope: 'private' | 'org' | 'community';
  consents: Consents;
  /** One https link per line. Optional so existing callers that omit it keep working. */
  links?: string;
}

const EMPTY: ObservationFormValues = {
  title: '', type: 'market_observation', description: '', offering: '', industry: '', region: '', periodStart: '', periodEnd: '', evidence: 'anecdotal', confidence: 'medium', scope: 'private',
  consents: { a: false, b: false, c: false, d: false, e: false }, links: '',
};

const TYPES = [
  ['market_observation', 'Market observation'], ['emerging_trend', 'Emerging trend'],
  ['product_gap', 'Product gap'], ['operational_challenge', 'Operational challenge'],
  ['successful_practice', 'Successful practice'], ['improvement_suggestion', 'Improvement suggestion'],
];
const EVIDENCE = [['anecdotal', 'Anecdotal'], ['quantitative', 'Quantitative'], ['case_study', 'Case study'], ['other', 'Other']];
const SCOPES: { value: ObservationFormValues['scope']; label: string; hint: string }[] = [
  { value: 'private', label: 'Only me', hint: 'Visible only to you and authorised reviewers when submitted.' },
  { value: 'org', label: 'My organisation', hint: 'Visible to your organisation after submission.' },
  { value: 'community', label: 'Propose for shared learning', hint: 'Only a separately reviewed copy can be published.' },
];
const FIELD = 'mt-1 w-full rounded-[12px] border border-az-grey-bg bg-white px-4 py-3 text-[15px] text-az-text outline-none focus:border-az-green';

function payloadFor(value: ObservationFormValues) {
  return {
    title: value.title.trim(),
    observation_type: value.type,
    offering: value.offering.trim() || undefined,
    industry: value.industry.trim() || undefined,
    region: value.region.trim() || undefined,
    evidence_type: value.evidence,
    confidence: value.confidence,
    body: value.description.trim(),
    ...(value.periodStart.trim() ? { observation_period_start: value.periodStart.trim() } : {}),
    ...(value.periodEnd.trim() ? { observation_period_end: value.periodEnd.trim() } : {}),
    visibility: value.scope === 'private' ? 'author' : value.scope === 'org' ? 'org' : 'community_proposed',
    consent_store_process: value.consents.a,
    consent_publish_reviewed: value.consents.b,
    consent_attribute: value.consents.c,
    consent_model_training: value.consents.d,
    consent_semantic_analysis: value.consents.e,
    reference_links: (value.links ?? '').split('\n').map((line) => line.trim()).filter(Boolean),
  };
}

export function ObservationForm({ initial, contributionId, demoPreview = false }: {
  initial?: ObservationFormValues; contributionId?: string; demoPreview?: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState<ObservationFormValues>(initial ?? EMPTY);
  const [recordId, setRecordId] = useState(contributionId);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  function update<K extends keyof ObservationFormValues>(key: K, next: ObservationFormValues[K]) {
    setValue((current) => ({ ...current, [key]: next }));
  }

  async function save(submit: boolean) {
    if (demoPreview) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(recordId
        ? `/api/v1/contributions/${recordId}` : '/api/v1/contributions', {
        method: recordId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadFor(value)),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'The contribution could not be saved.');
      const id = recordId ?? result.data?.id;
      if (!id) throw new Error('The contribution was saved without an identifier.');
      setRecordId(id);
      if (submit) {
        const submission = await fetch(`/api/v1/contributions/${id}/submit`, { method: 'POST' });
        const submitted = await submission.json();
        if (!submission.ok) throw new Error(submitted.error ?? 'The contribution could not be submitted.');
      }
      setMessage(submit ? 'Contribution submitted for review.' : 'Draft saved.');
      router.push(`/portal/client/observations/${id}`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The contribution could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="space-y-6">
    <Card className="space-y-6 p-6 md:p-8">
      <div className="rounded-[12px] border-l-4 border-az-error bg-az-grey-bg/60 p-4 text-sm text-az-text" role="note">
        <p className="font-semibold text-az-error">Before you write</p>
        <p className="mt-1">Do not include customer names, account numbers, transaction-level data, credentials or confidential contract terms. Automated checks are only a helper.</p>
      </div>
      <label className="block text-sm font-semibold text-az-navy">Title
        <input className={FIELD} value={value.title} maxLength={200} required minLength={3} onChange={(event) => update('title', event.target.value)} />
      </label>
      <div className="grid gap-6 md:grid-cols-2">
        <label className="block text-sm font-semibold text-az-navy">Observation type
          <select className={FIELD} value={value.type} onChange={(event) => update('type', event.target.value)}>{TYPES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
        </label>
        <label className="block text-sm font-semibold text-az-navy">Evidence type
          <select className={FIELD} value={value.evidence} onChange={(event) => update('evidence', event.target.value)}>{EVIDENCE.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
        </label>
      </div>
      <label className="block text-sm font-semibold text-az-navy">Description
        <textarea className={FIELD} value={value.description} rows={7} maxLength={5000} minLength={10} required onChange={(event) => update('description', event.target.value)} />
        <span className="mt-1 block text-xs font-normal text-az-text-muted">Describe the pattern in general terms and avoid identifiers.</span>
      </label>
      <label className="block text-sm font-semibold text-az-navy">Reference links (optional, one per line, https only)
        <textarea className={FIELD} value={value.links ?? ''} rows={3} placeholder="https://example.com/article" onChange={(event) => update('links', event.target.value)} />
        <span className="mt-1 block text-xs font-normal text-az-text-muted">Up to 5 links. Do not link to confidential documents or anything that needs a login. Links follow the same visibility as this observation and are kept out of shared copies unless a moderator keeps them.</span>
      </label>
      <div className="grid gap-6 md:grid-cols-3">
        <label className="block text-sm font-semibold text-az-navy">Offering<input className={FIELD} value={value.offering} maxLength={100} onChange={(event) => update('offering', event.target.value)} /></label>
        <label className="block text-sm font-semibold text-az-navy">Industry<input className={FIELD} value={value.industry} maxLength={100} onChange={(event) => update('industry', event.target.value)} /></label>
        <label className="block text-sm font-semibold text-az-navy">Region<input className={FIELD} value={value.region} maxLength={100} onChange={(event) => update('region', event.target.value)} /></label>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <label className="block text-sm font-semibold text-az-navy">Observation period start
          <input className={FIELD} type="date" value={value.periodStart} onChange={(event) => update('periodStart', event.target.value)} />
        </label>
        <label className="block text-sm font-semibold text-az-navy">Observation period end
          <input className={FIELD} type="date" value={value.periodEnd} onChange={(event) => update('periodEnd', event.target.value)} />
        </label>
      </div>
      <label className="block text-sm font-semibold text-az-navy">Confidence
        <select className={FIELD} value={value.confidence} onChange={(event) => update('confidence', event.target.value)}>{[['low', 'Low'], ['medium', 'Medium'], ['high', 'High']].map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
      </label>
      <fieldset>
        <legend className="text-sm font-semibold text-az-navy">Sharing scope</legend>
        <div className="mt-3 space-y-3">{SCOPES.map((scope) => (
          <label key={scope.value} className="flex cursor-pointer items-start gap-3 rounded-[12px] border border-az-grey-bg p-4">
            <input type="radio" name="scope" value={scope.value} checked={value.scope === scope.value} onChange={() => update('scope', scope.value)} className="mt-1 accent-az-navy" />
            <span><span className="block text-sm font-semibold text-az-navy">{scope.label}</span><span className="block text-xs text-az-text-muted">{scope.hint}</span></span>
          </label>
        ))}</div>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-semibold text-az-navy">Separate consent choices</legend>
        <p className="mt-1 text-xs text-az-text-muted">Consent to storage is required to save. The other choices remain independent.</p>
        <div className="mt-3 space-y-3">{CONSENT_ITEMS.map((item) => {
          const key = item.key;
          return <label key={key} className="flex cursor-pointer items-start gap-3 rounded-[12px] border border-az-grey-bg p-4">
            <input type="checkbox" checked={value.consents[key]} onChange={(event) => update('consents', { ...value.consents, [key]: event.target.checked })} className="mt-1 accent-az-navy" />
            <span><span className="block text-sm font-semibold text-az-navy">{item.label}{key === 'a' || (key === 'b' && value.scope === 'community') ? ' (required)' : ''}</span><span className="block text-xs text-az-text-muted">{item.hint}</span></span>
          </label>;
        })}</div>
      </fieldset>
    </Card>
    {!demoPreview ? <div className="flex flex-wrap gap-3">
      <button type="button" disabled={busy || !value.consents.a || (value.scope === 'community' && !value.consents.b)} onClick={() => void save(false)} className="rounded-full border-2 border-az-navy px-6 py-2.5 text-sm font-semibold text-az-navy cursor-pointer active:scale-[0.96] transition-all disabled:cursor-not-allowed disabled:opacity-50">Save draft</button>
      <button type="button" disabled={busy || !value.consents.a || (value.scope === 'community' && !value.consents.b)} onClick={() => void save(true)} className="rounded-full bg-az-mint px-6 py-2.5 text-sm font-semibold text-az-navy cursor-pointer active:scale-[0.96] transition-all disabled:cursor-not-allowed disabled:opacity-50">Save and submit</button>
      {recordId && <Link href={`/portal/client/observations/${recordId}`} className="rounded-full px-6 py-2.5 text-sm font-semibold text-az-navy cursor-pointer active:scale-[0.96] transition-all">Cancel</Link>}
    </div> : <PreviewNote />}
    {message && <p role="status" className="text-sm text-az-text-muted">{message}</p>}
  </div>;
}
