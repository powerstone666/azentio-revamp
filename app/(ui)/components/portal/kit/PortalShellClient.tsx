'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useSyncExternalStore } from 'react';
import { PERSONAS } from '@/app/(config)/personas';
import { orgById } from '@/app/(config)/mock/portal';
import { CaretDown, SignOut } from '@phosphor-icons/react';
import { NotificationBell } from './NotificationBell';

// Original Azentio header pattern: white bar, logo left, nav links, pills right. No GSAP in the portal.

type Area = 'client' | 'employee' | 'moderator' | 'product-owner' | 'admin';

const AREAS: Record<Area, { label: string; nav: { label: string; href: string }[]; user: { name: string; role: string; org: string } }> = {
  client: {
    label: 'Client workspace',
    nav: [
      { label: 'Dashboard', href: '/portal/client' },
      { label: 'Observations', href: '/portal/client/observations' },
      { label: 'Shared learning', href: '/portal/client/shared-learning' },
      { label: 'Themes', href: '/portal/client/themes' },
      { label: 'Ideas', href: '/portal/client/ideas' },
      { label: 'Demos', href: '/portal/client/demos' },
      { label: 'Resources', href: '/portal/client/resources' },
      { label: 'Release notes', href: '/portal/client/release-notes' },
      { label: 'Support', href: '/portal/client/support' },
      { label: 'Team', href: '/portal/client/admin/team' },
    ],
    user: { name: 'Amira Haddad', role: 'Client member', org: 'Harborline Commercial Bank' },
  },
  employee: {
    label: 'Employee portal',
    nav: [
      { label: 'Dashboard', href: '/portal/employee' },
      { label: 'Playground', href: '/portal/employee/playground' },
      { label: 'Live', href: '/portal/employee/live' },
      { label: 'Experiments', href: '/portal/employee/experiments' },
      { label: 'Hackathon teams', href: '/portal/employee/hackathon-teams' },
      { label: 'Knowledge', href: '/portal/employee/knowledge' },
      { label: 'Release notes', href: '/portal/employee/release-notes' },
      { label: 'Public content', href: '/portal/employee/content' },
    ],
    user: { name: 'Dana Whitfield', role: 'Employee', org: 'Azentio' },
  },
  moderator: {
    label: 'Learning moderation',
    nav: [
      { label: 'Overview', href: '/portal/moderator' },
      { label: 'Review queue', href: '/portal/moderator/queue' },
      { label: 'Reports', href: '/portal/moderator/reports' },
      { label: 'Audit', href: '/portal/moderator/audit' },
    ],
    user: { name: 'Ines Calderon', role: 'Learning moderator', org: 'Azentio' },
  },
  'product-owner': {
    label: 'Product owner',
    nav: [
      { label: 'Overview', href: '/portal/product-owner' },
      { label: 'Themes', href: '/portal/product-owner/themes' },
      { label: 'New idea', href: '/portal/product-owner/ideas/new' },
    ],
    user: { name: 'Tomas Reiniger', role: 'Product owner (FAI)', org: 'Azentio' },
  },
  admin: {
    label: 'Administration',
    nav: [
      { label: 'Overview', href: '/portal/admin' },
      { label: 'Organisations', href: '/portal/admin/organizations' },
      { label: 'Public enquiries', href: '/portal/admin/public-submissions' },
      { label: 'Support tickets', href: '/portal/admin/support-tickets' },
    ],
    user: { name: 'Sunita Varghese', role: 'Portal admin', org: 'Azentio' },
  },
};

// Mock login: the sign-in page stores the chosen persona (and workspace) in cookies. Real sign-in replaces this later.
const readCookie = (name: string) => {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : '';
};
const snapshot = () => `${readCookie('azentio_mock_persona')}|${readCookie('azentio_mock_org')}`;
const subscribe = (cb: () => void) => {
  window.addEventListener('focus', cb);
  return () => window.removeEventListener('focus', cb);
};
const signOut = async () => {
  if (!readCookie('azentio_mock_persona')) {
    // Better Auth rejects POSTs without a JSON content type (415), which leaves the session cookie in place.
    await fetch('/api/v1/auth/sign-out', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}', credentials: 'include' }).catch(() => undefined);
  }
  document.cookie = 'azentio_mock_persona=; Max-Age=0; path=/';
  document.cookie = 'azentio_mock_org=; Max-Age=0; path=/';
};

const areaOf = (path: string): Area | null => {
  const seg = path.split('/')[2];
  return seg && seg in AREAS ? (seg as Area) : null;
};

export default function PortalShell({ children, realUser }: {
  children: React.ReactNode;
  realUser: { name: string; role: string; org: string; isSandbox: boolean } | null;
}) {
  const pathname = usePathname();
  const area = areaOf(pathname);
  const base = area ? AREAS[area] : null;
  const [personaEmail, orgId] = useSyncExternalStore(subscribe, snapshot, () => '|').split('|');
  const persona = PERSONAS.find((p) => p.email === personaEmail);
  const org = orgById(orgId);
  const user = persona
    ? { name: persona.name, role: persona.role, org: org && persona.org.includes('+') ? org.name : persona.org }
    : realUser ?? base?.user;
  const cfg = base && user ? { ...base, user } : null;
  const initials = cfg?.user.name.split(' ').map((n) => n[0]).join('') ?? '';

  return (
    <div className="flex min-h-screen flex-col bg-white font-sans text-az-text">
      <div className="bg-az-navy px-5 py-2 text-center text-xs text-white/80">
        {persona ? `Demo sign-in: browsing as ${persona.name}. All displayed data is synthetic.` : realUser?.isSandbox
          ? 'Shared product demo: activity is visible to other demo members. Use synthetic examples only; never enter customer or confidential information.'
          : 'Secure workspace'}
      </div>
      <header className="border-b border-az-grey-bg bg-white">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-5 py-4 md:px-10">
          <Link href="/portal" aria-label="Portal home" className="shrink-0"><Image src="/brand/azentio-logo.svg" alt="Azentio" width={132} height={36} priority /></Link>
          <div className="flex items-center gap-3">
            {cfg && (
              realUser && !persona ? (
                <>
                  <Link href="/workspace/select" title="Switch workspace" className="hidden items-center gap-2 rounded-[50px] border border-az-grey-bg px-4 py-2 text-sm text-az-navy transition-all duration-150 hover:border-az-green hover:bg-az-mint-tint cursor-pointer active:scale-[0.96] ease-[cubic-bezier(0.34,1.56,0.64,1)] sm:flex">
                    <span className="max-w-[200px] truncate">{cfg.user.org}</span><span className="text-xs font-semibold text-az-text-muted">Switch</span><CaretDown size={12} weight="bold" aria-hidden />
                  </Link>
                </>
              ) : (
                <span className="hidden items-center gap-2 rounded-[50px] border border-az-grey-bg px-4 py-2 text-sm text-az-navy sm:flex" title="Active workspace">
                  <span className="max-w-[200px] truncate">{cfg.user.org}</span><CaretDown size={12} weight="bold" aria-hidden />
                </span>
              )
            )}
            {!persona && <NotificationBell />}
            {cfg && (
              <span className="flex items-center gap-2.5" title={`${cfg.user.name}, ${cfg.user.role}`}>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-az-green text-sm font-semibold text-az-navy" aria-hidden>{initials}</span>
                <span className="hidden leading-tight md:block"><span className="block text-sm font-semibold text-az-navy">{cfg.user.name}</span><span className="block text-xs text-az-text-muted">{cfg.user.role}</span></span>
              </span>
            )}
            <Link href="/login" onClick={async (event) => { event.preventDefault(); await signOut(); window.location.assign('/login'); }} className="inline-flex shrink-0 items-center gap-1.5 rounded-[50px] bg-az-navy px-5 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-az-navy/90 cursor-pointer active:scale-[0.96] ease-[cubic-bezier(0.34,1.56,0.64,1)]">
              <SignOut size={16} weight="bold" aria-hidden />Sign out
            </Link>
          </div>
        </div>
        {cfg && (
          <nav aria-label="Portal" className="border-t border-az-grey-bg">
            <div className="mx-auto flex max-w-[1280px] gap-1 overflow-x-auto px-5 py-2 md:px-10">
              {cfg.nav.map((n) => {
                const active = n.href === pathname || (n.href !== `/portal/${area}` && pathname.startsWith(n.href));
                return (
                  <Link key={n.href} href={n.href} aria-current={active ? 'page' : undefined}
                    className={`whitespace-nowrap rounded-[50px] px-4 py-2 text-[15px] transition-all duration-150 cursor-pointer active:scale-[0.98] ${active ? 'bg-az-mint-tint font-semibold text-az-navy' : 'text-az-text hover:text-az-green'}`}>
                    {n.label}
                  </Link>
                );
              })}
            </div>
          </nav>
        )}
      </header>
      <main className="flex-1">{children}</main>
      <footer className="bg-az-navy py-6 text-center text-xs text-white/60">© 2026 Azentio</footer>
    </div>
  );
}
