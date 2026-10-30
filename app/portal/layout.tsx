import PortalShell from '@/app/(ui)/components/portal/kit/PortalShell';

// Portal pages read cookies and the session on every request, so they cannot be prerendered.
export const instant = false;

/**
 * Portal shell layout: header, navigation, footer. It makes no authorization decisions;
 * each page and Server Action authorizes independently through the DAL.
 */
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <PortalShell>{children}</PortalShell>;
}
