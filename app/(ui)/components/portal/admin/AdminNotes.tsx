import { Card } from '@/app/(ui)/components/portal/kit/ui';

/** Note card stating that employee status does not grant admin access. */
export function GrantsNoteCard() {
  return (
    <Card>
      <p className="text-[15px] leading-relaxed text-az-text">
        Employee status does not imply admin access. Publishing, moderation, inviting users and changing roles are separate grants.
      </p>
    </Card>
  );
}

/** Support access is explicit, time-limited and audited, and is separate from role grants. */
export function SupportAccessCard() {
  return (
    <Card>
      <h2 className="text-[20px] font-semibold text-az-navy">Support access</h2>
      <p className="mt-3 text-[15px] leading-relaxed text-az-text">
        Support access is explicit, time-limited and audited, and is separate from role grants.
      </p>
    </Card>
  );
}
