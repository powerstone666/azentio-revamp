'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { REASON_CODES } from './rules';

type Payload = {
  title?: unknown; observation_type?: unknown; offering?: unknown; industry?: unknown; region?: unknown;
  observation_period_start?: unknown; observation_period_end?: unknown; evidence_type?: unknown; confidence?: unknown; body?: unknown;
};

const OBSERVATION_TYPES = ['market_observation', 'emerging_trend', 'product_gap', 'operational_challenge', 'successful_practice', 'improvement_suggestion'];
const EVIDENCE_TYPES = ['anecdotal', 'quantitative', 'case_study', 'other'];
const CONFIDENCE = ['low', 'medium', 'high'];
const EVIDENCE_QUALITY = [
  { value: 'weak', label: 'Weak — anecdotal or limited support' },
  { value: 'moderate', label: 'Moderate — aggregated or partially verified' },
  { value: 'strong', label: 'Strong — documented and reviewed evidence' },
];

export function ModerationDecisionForm({ contributionId, status, visibility, source, decisionNote }: {
  contributionId: string; status: string; visibility: string; source: Payload; decisionNote?: string | null;
}) {
  const router = useRouter();
  const [fields, setFields] = useState({
    title: String(source.title ?? ''),
    observation_type: String(source.observation_type ?? 'market_observation'),
    offering: String(source.offering ?? ''),
    industry: String(source.industry ?? ''),
    region: String(source.region ?? ''),
    observation_period_start: String(source.observation_period_start ?? ''),
    observation_period_end: String(source.observation_period_end ?? ''),
    evidence_type: String(source.evidence_type ?? 'other'),
    confidence: String(source.confidence ?? 'low'),
    body: String(source.body ?? ''),
  });
  const [reasonCode, setReasonCode] = useState(REASON_CODES[0]);
  const [clarification, setClarification] = useState('');
  const [attributionConsent, setAttributionConsent] = useState(false);
  const [attributionLabel, setAttributionLabel] = useState('');
  const [confirmedReview, setConfirmedReview] = useState(false);
  const [evidenceQuality, setEvidenceQuality] = useState<'weak' | 'moderate' | 'strong'>('weak');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const canApprove = status === 'submitted';
  const canPublish = status === 'approved' && visibility === 'community_proposed';
  const isPublishingAction = (action: string) => action === 'publish' || (action === 'approve' && visibility === 'community_proposed');

  async function decide(action: 'clarify' | 'reject' | 'approve' | 'publish' | 'suspend' | 'reinstate') {
    setBusy(true);
    setMessage('');
    const publishing = isPublishingAction(action);
    const payload = publishing ? {
      ...fields,
      offering: fields.offering || null,
      industry: fields.industry || null,
      region: fields.region || null,
      observation_period_start: fields.observation_period_start || null,
      observation_period_end: fields.observation_period_end || null,
      ...(attributionConsent ? { attribution_label: attributionLabel.trim() } : {}),
    } : undefined;
    try {
      const response = await fetch(`/api/v1/moderation/contributions/${contributionId}/decision`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason_code: reasonCode, clarification_message: clarification || undefined, redacted_payload: payload, deidentified: !attributionConsent, attribution_consent: attributionConsent, evidence_quality: evidenceQuality }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'The decision could not be saved.');
      setMessage(`Saved. Contribution state: ${result.data.state}.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The decision could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  function update<K extends keyof typeof fields>(key: K, value: string) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  return <div className="space-y-6">
    {status === 'needs_clarification' && decisionNote && <div className="rounded-xl bg-az-mint-tint p-4 text-sm text-az-text"><p className="font-semibold text-az-navy">Clarification requested</p><p className="mt-2 whitespace-pre-line">{decisionNote}</p><p className="mt-2 text-xs text-az-text-muted">Waiting for the contributor to amend and resubmit.</p></div>}
    {(canApprove || canPublish) && <>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-az-navy">Shared title<input value={fields.title} maxLength={200} onChange={(event) => update('title', event.target.value)} className="mt-1 w-full rounded-xl border border-az-grey-bg px-3 py-2 font-normal" /></label>
        <label className="text-sm font-semibold text-az-navy">Observation type<select value={fields.observation_type} onChange={(event) => update('observation_type', event.target.value)} className="mt-1 w-full rounded-xl border border-az-grey-bg px-3 py-2 font-normal">{OBSERVATION_TYPES.map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></label>
        <label className="text-sm font-semibold text-az-navy">Offering<input value={fields.offering} maxLength={100} onChange={(event) => update('offering', event.target.value)} className="mt-1 w-full rounded-xl border border-az-grey-bg px-3 py-2 font-normal" /></label>
        <label className="text-sm font-semibold text-az-navy">Industry<input value={fields.industry} maxLength={100} onChange={(event) => update('industry', event.target.value)} className="mt-1 w-full rounded-xl border border-az-grey-bg px-3 py-2 font-normal" /></label>
        <label className="text-sm font-semibold text-az-navy">Region<input value={fields.region} maxLength={100} onChange={(event) => update('region', event.target.value)} className="mt-1 w-full rounded-xl border border-az-grey-bg px-3 py-2 font-normal" /></label>
        <label className="text-sm font-semibold text-az-navy">Evidence type<select value={fields.evidence_type} onChange={(event) => update('evidence_type', event.target.value)} className="mt-1 w-full rounded-xl border border-az-grey-bg px-3 py-2 font-normal">{EVIDENCE_TYPES.map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></label>
        <label className="text-sm font-semibold text-az-navy">Confidence<select value={fields.confidence} onChange={(event) => update('confidence', event.target.value)} className="mt-1 w-full rounded-xl border border-az-grey-bg px-3 py-2 font-normal">{CONFIDENCE.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      </div>
      <label className="block text-sm font-semibold text-az-navy">Reviewed shared text<textarea value={fields.body} minLength={10} maxLength={5000} rows={8} onChange={(event) => update('body', event.target.value)} className="mt-1 w-full rounded-xl border border-az-grey-bg px-4 py-3 font-normal" /></label>
      <label className="block text-sm font-semibold text-az-navy">Reviewer-assessed evidence quality<select value={evidenceQuality} onChange={(event) => setEvidenceQuality(event.target.value as typeof evidenceQuality)} className="mt-1 w-full rounded-xl border border-az-grey-bg px-3 py-2 font-normal">{EVIDENCE_QUALITY.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><span className="mt-1 block text-xs font-normal text-az-text-muted">Assess the strength and limits of the evidence; this is not a popularity score.</span></label>
      <label className="flex items-start gap-2 text-sm text-az-text"><input type="checkbox" checked={confirmedReview} onChange={(event) => setConfirmedReview(event.target.checked)} className="mt-1" />I reviewed this copy for customer identifiers, account details, confidential terms and combinations that could identify the contributor.</label>
      <label className="flex items-center gap-2 text-sm text-az-text"><input type="checkbox" checked={attributionConsent} onChange={(event) => setAttributionConsent(event.target.checked)} />Use contributor attribution (only if separately consented)</label>
      {attributionConsent && <label className="block text-sm font-semibold text-az-navy">Reviewed attribution label<input value={attributionLabel} maxLength={100} onChange={(event) => setAttributionLabel(event.target.value)} className="mt-1 w-full rounded-xl border border-az-grey-bg px-3 py-2 font-normal" /></label>}
    </>}

    <label className="block text-sm font-semibold text-az-navy">Reason code<select value={reasonCode} onChange={(event) => setReasonCode(event.target.value)} className="mt-1 w-full rounded-xl border border-az-grey-bg px-3 py-2 font-normal">{REASON_CODES.map((value) => <option key={value}>{value}</option>)}</select></label>
    {status === 'submitted' && <label className="block text-sm font-semibold text-az-navy">Clarification request<textarea value={clarification} maxLength={2000} rows={3} onChange={(event) => setClarification(event.target.value)} className="mt-1 w-full rounded-xl border border-az-grey-bg px-3 py-2 font-normal" /></label>}
    <div className="flex flex-wrap gap-3">
      {status === 'submitted' && <><button disabled={busy || !clarification.trim()} onClick={() => void decide('clarify')} className="rounded-full border border-az-grey-bg px-4 py-2 text-sm font-semibold text-az-navy disabled:opacity-50">Request clarification</button><button disabled={busy || (visibility === 'community_proposed' && (!confirmedReview || fields.body.trim().length < 10))} onClick={() => void decide('approve')} className="rounded-full bg-az-green px-4 py-2 text-sm font-semibold text-az-navy disabled:opacity-50">Approve</button><button disabled={busy} onClick={() => void decide('reject')} className="rounded-full bg-az-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Reject</button></>}
      {canPublish && <button disabled={busy || !confirmedReview || fields.body.trim().length < 10 || (attributionConsent && !attributionLabel.trim())} onClick={() => void decide('publish')} className="rounded-full bg-az-green px-4 py-2 text-sm font-semibold text-az-navy disabled:opacity-50">Publish reviewed copy</button>}
      {status === 'approved' && <button disabled={busy} onClick={() => void decide('reject')} className="rounded-full border border-az-error px-4 py-2 text-sm font-semibold text-az-error disabled:opacity-50">Reject approval</button>}
      {status === 'published' && <button disabled={busy} onClick={() => void decide('suspend')} className="rounded-full border border-az-error px-4 py-2 text-sm font-semibold text-az-error disabled:opacity-50">Suspend shared copy</button>}
      {status === 'suspended' && <button disabled={busy} onClick={() => void decide('reinstate')} className="rounded-full bg-az-green px-4 py-2 text-sm font-semibold text-az-navy disabled:opacity-50">Reinstate</button>}
    </div>
    {message && <p role="status" className="text-sm text-az-text-muted">{message}</p>}
  </div>;
}
