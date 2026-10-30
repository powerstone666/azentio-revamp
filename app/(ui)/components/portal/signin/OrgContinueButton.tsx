'use client';

import { useRouter } from 'next/navigation';
import { setMockOrgCookie } from '@/app/(ui)/components/portal/signin/mockSession';

export function OrgContinueButton({ orgId }: { orgId: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        setMockOrgCookie(orgId);
        router.push('/portal/client');
      }}
      className="inline-flex items-center gap-2 rounded-[50px] bg-az-mint px-6 py-2.5 text-[15px] font-semibold text-az-navy transition-colors duration-150 hover:bg-az-mint/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-az-green"
    >
      Continue
    </button>
  );
}
