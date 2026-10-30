'use client';

import { useId } from 'react';
import { PillButton } from '@/app/(ui)/components/portal/kit/ui';
import { AUDIENCES, OFFERINGS, PRIORITIES } from '@/app/(ui)/components/portal/staff/rules';
import { PreviewNote } from '@/app/(ui)/components/portal/staff/PreviewNote';

export interface ThemeOption { id: string; title: string }

const field = 'w-full rounded-[12px] border border-az-grey-bg bg-white px-4 py-3 text-[15px] text-az-text transition-colors duration-150 focus-visible:border-az-green focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-az-green';
const label = 'mb-1.5 block text-sm font-semibold text-az-navy';

/** New improvement idea form. Submit is disabled in this preview build. */
export default function IdeaForm({ themes }: { themes: ThemeOption[] }) {
  const uid = useId();
  const f = (name: string) => `${uid}-${name}`;

  return (
    <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
      <div className="rounded-[12px] bg-az-mint-tint px-5 py-4 text-sm font-semibold text-az-navy">
        An idea is not a delivery commitment.
      </div>

      <div>
        <label htmlFor={f('title')} className={label}>Title</label>
        <input id={f('title')} name="title" type="text" className={field} />
      </div>

      <div>
        <label htmlFor={f('problem')} className={label}>Problem statement</label>
        <textarea id={f('problem')} name="problem" rows={4} className={field} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <label htmlFor={f('offering')} className={label}>Offering</label>
          <select id={f('offering')} name="offering" className={field}>
            {OFFERINGS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={f('owner')} className={label}>Owner team</label>
          <input id={f('owner')} name="owner" type="text" className={field} />
        </div>
        <div>
          <label htmlFor={f('priority')} className={label}>Priority</label>
          <select id={f('priority')} name="priority" className={field} defaultValue="Medium">
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={f('audience')} className={label}>Audience</label>
          <select id={f('audience')} name="audience" className={field} defaultValue="Internal">
            {AUDIENCES.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      <fieldset>
        <legend className={label}>Linked evidence (visible themes only)</legend>
        {themes.length === 0 ? (
          <p className="text-sm text-az-text-muted">No visible themes yet.</p>
        ) : (
          <div className="space-y-2">
            {themes.map((t) => (
              <label key={t.id} className="flex items-start gap-3 rounded-[12px] border border-az-grey-bg bg-white px-4 py-3 text-[15px] text-az-text">
                <input type="checkbox" name="evidence" value={t.id} className="mt-1 h-4 w-4 accent-az-green" />
                <span>{t.title}</span>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <div>
        <label htmlFor={f('outcome')} className={label}>Proposed outcome</label>
        <textarea id={f('outcome')} name="outcome" rows={3} className={field} />
      </div>

      <div>
        <label htmlFor={f('status')} className={label}>Initial status</label>
        <input id={f('status')} name="status" type="text" value="Proposed" readOnly disabled className={`${field} bg-az-grey-bg/60 text-az-text-muted`} />
      </div>

      <div className="flex flex-col gap-4 border-t border-az-grey-bg pt-6">
        <PreviewNote />
        <div>
          <PillButton type="submit" disabled>Submit idea</PillButton>
        </div>
      </div>
    </form>
  );
}
