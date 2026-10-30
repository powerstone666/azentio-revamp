import PortalShell from '@/app/(ui)/components/portal/kit/PortalShell';

/**
 * Portal shell layout: header, navigation, footer. It makes no authorization decisions;
 * each page and Server Action authorizes independently through the DAL (arrives with M1).
 */
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <PortalShell>{children}</PortalShell>;
}
