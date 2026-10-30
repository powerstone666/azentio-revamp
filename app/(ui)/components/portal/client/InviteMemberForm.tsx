'use client';

import { Card, PillButton } from '@/app/(ui)/components/portal/kit/ui';
import { PreviewNote } from './PreviewNote';

const LABEL = 'block text-sm font-semibold text-az-navy';
const FIELD = 'mt-2 w-full rounded-[12px] border border-az-grey-bg bg-white px-4 py-2.5 text-[15px] text-az-text outline-none transition-colors duration-150 focus:border-az-green';

/** Invite form. The submit button is disabled and nothing is sent in this preview. */
export function InviteMemberForm() {
  return (
    <form onSubmit={(e) => e.preventDefault()} aria-label="Invite a member">
      <Card className="space-y-5 p-6 md:p-8">
        <div className="grid gap-5 md:grid-cols-[1fr_220px]">
          <div>
            <label htmlFor="invite-email" className={LABEL}>Email</label>
            <input id="invite-email" name="email" type="email" placeholder="name@organisation.example" className={FIELD} />
          </div>
          <div>
            <label htmlFor="invite-role" className={LABEL}>Role</label>
            <select id="invite-role" name="role" defaultValue="Client member" className={FIELD}>
              <option>Client member</option>
              <option>Client admin</option>
            </select>
          </div>
        </div>
        <div>
          <PillButton type="submit" tone="mint" disabled>Send invitation</PillButton>
        </div>
        <PreviewNote />
      </Card>
    </form>
  );
}
