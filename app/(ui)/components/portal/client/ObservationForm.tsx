'use client';

import { Card, PillButton } from '@/app/(ui)/components/portal/kit/ui';
import { CONSENT_ITEMS, EVIDENCE_TYPES, OBSERVATION_TYPES, type Consents } from './shared';
import { PreviewNote } from './PreviewNote';

export interface ObservationFormValues {
  title: string;
  type: string;
  description: string;
  period: string;
  evidence: string;
  scope: 'private' | 'org' | 'community';
  consents: Consents;
}

const EMPTY: ObservationFormValues = {
  title: '',
  type: OBSERVATION_TYPES[0],
  description: '',
  period: '',
  evidence: EVIDENCE_TYPES[0],
  scope: 'private',
  consents: { a: false, b: false, c: false, d: false },
};

const LABEL = 'block text-sm font-semibold text-az-navy';
const FIELD = 'mt-2 w-full rounded-[12px] border border-az-grey-bg bg-white px-4 py-2.5 text-[15px] text-az-text outline-none transition-colors duration-150 focus:border-az-green';
const HELP = 'mt-1 text-xs text-az-text-muted';

const SCOPES: { value: ObservationFormValues['scope']; label: string; hint: string }[] = [
  { value: 'private', label: 'Only me', hint: 'Visible to you only.' },
  { value: 'org', label: 'My organisation', hint: 'Visible to members of Harborline Commercial Bank.' },
  { value: 'community', label: 'Community (proposed for moderator review)', hint: 'Nothing is shared unless a moderator reviews and publishes a shared copy.' },
];

/** Shared form for new and edited observations. Nothing is saved or submitted in this preview. */
export function ObservationForm({ mode, initial }: { mode: 'new' | 'edit'; initial?: ObservationFormValues }) {
  const v = initial ?? EMPTY;
  return (
    <form onSubmit={(e) => e.preventDefault()} className="space-y-6" aria-label={mode === 'new' ? 'New observation' : 'Edit observation'}>
      <Card className="space-y-6 p-6 md:p-8">
        <div className="rounded-[12px] border-l-4 border-az-error bg-az-grey-bg/60 p-4 text-sm text-az-text" role="note">
          <p className="font-semibold text-az-error">Before you write</p>
          <p className="mt-1">
            Do not include customer names, account numbers, transaction-level data, credentials or confidential contract terms. A warning is not a privacy guarantee.
          </p>
        </div>

        <div>
          <label htmlFor="obs-title" className={LABEL}>Title</label>
          <input id="obs-title" name="title" type="text" defaultValue={v.title} maxLength={140} className={FIELD} />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label htmlFor="obs-type" className={LABEL}>Type</label>
            <select id="obs-type" name="type" defaultValue={v.type} className={FIELD}>
              {OBSERVATION_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="obs-evidence" className={LABEL}>Evidence type</label>
            <select id="obs-evidence" name="evidence" defaultValue={v.evidence} className={FIELD}>
              {EVIDENCE_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="obs-description" className={LABEL}>Description</label>
          <textarea id="obs-description" name="description" rows={6} defaultValue={v.description} className={FIELD} />
          <p className={HELP}>Describe the pattern in general terms. Avoid identifiers.</p>
        </div>

        <div>
          <label htmlFor="obs-period" className={LABEL}>Period</label>
          <input id="obs-period" name="period" type="text" placeholder="For example, Q1 2026 or FY2025" defaultValue={v.period} className={FIELD} />
        </div>

        <fieldset>
          <legend className={LABEL}>Sharing scope</legend>
          <div className="mt-3 space-y-3">
            {SCOPES.map((s) => (
              <label key={s.value} className="flex cursor-pointer items-start gap-3 rounded-[12px] border border-az-grey-bg p-4 transition-colors duration-150 hover:border-az-green">
                <input type="radio" name="scope" value={s.value} defaultChecked={v.scope === s.value} className="mt-1 h-4 w-4 accent-az-navy" />
                <span>
                  <span className="block text-sm font-semibold text-az-navy">{s.label}</span>
                  <span className="block text-xs text-az-text-muted">{s.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className={LABEL}>Consent</legend>
          <p className={HELP}>Each choice is separate. Nothing is ticked for you.</p>
          <div className="mt-3 space-y-3">
            {CONSENT_ITEMS.map((c) => (
              <label key={c.key} className="flex cursor-pointer items-start gap-3 rounded-[12px] border border-az-grey-bg p-4 transition-colors duration-150 hover:border-az-green">
                <input type="checkbox" name={`consent-${c.key}`} defaultChecked={v.consents[c.key]} className="mt-1 h-4 w-4 accent-az-navy" />
                <span>
                  <span className="block text-sm font-semibold text-az-navy">({c.key}) {c.label}</span>
                  <span className="block text-xs text-az-text-muted">{c.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <PillButton tone="outline" disabled>Save draft</PillButton>
        <PillButton tone="mint" disabled>Submit for review</PillButton>
      </div>
      <PreviewNote />
    </form>
  );
}
