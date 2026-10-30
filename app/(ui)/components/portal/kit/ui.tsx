import Link from 'next/link';
import type { ReactNode } from 'react';

// Original Azentio look: white page, navy text, mint pill actions, 12px cards, 3px mint underline on titles.

export function PortalContainer({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1280px] px-5 md:px-10 ${className}`}>{children}</div>;
}

/** Navy page header band with white title, mint underline and optional action pills. */
export function PageHeader({ title, description, crumbs, actions }: { title: string; description?: string; crumbs?: { label: string; href?: string }[]; actions?: ReactNode }) {
  return (
    <section className="bg-az-navy text-white">
      <PortalContainer className="py-8 md:py-10">
        {crumbs && (
          <nav aria-label="Breadcrumb" className="mb-3 text-sm text-white/60">
            {crumbs.map((c, i) => (
              <span key={c.label}>
                {i > 0 && <span className="mx-2">/</span>}
                {c.href ? <Link href={c.href} className="hover:text-az-mint">{c.label}</Link> : <span className="text-white">{c.label}</span>}
              </span>
            ))}
          </nav>
        )}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[32px] font-semibold leading-tight md:text-[38px]"><span className="border-b-[3px] border-az-mint pb-1">{title}</span></h1>
            {description && <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-white/80">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
        </div>
      </PortalContainer>
    </section>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[12px] bg-white p-6 shadow-card ${className}`}>{children}</div>;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <h2 className="text-[24px] font-semibold text-az-navy"><span className="border-b-[3px] border-az-mint pb-0.5">{children}</span></h2>
      {action}
    </div>
  );
}

const PILL = {
  navy: 'bg-az-navy text-white hover:bg-az-navy/90',
  mint: 'bg-az-mint text-az-navy hover:bg-az-mint/80',
  outline: 'border-2 border-az-navy text-az-navy hover:bg-az-navy hover:text-white',
  'outline-light': 'border-2 border-white/70 text-white hover:bg-white hover:text-az-navy',
};
export function PillLink({ href, children, tone = 'mint', className = '' }: { href: string; children: ReactNode; tone?: keyof typeof PILL; className?: string }) {
  return <Link href={href} className={`inline-flex items-center gap-2 rounded-[50px] px-6 py-2.5 text-[15px] font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-az-green ${PILL[tone]} ${className}`}>{children}</Link>;
}
export function PillButton({ children, tone = 'mint', type = 'button', disabled, className = '' }: { children: ReactNode; tone?: keyof typeof PILL; type?: 'button' | 'submit'; disabled?: boolean; className?: string }) {
  return <button type={type} disabled={disabled} className={`inline-flex items-center gap-2 rounded-[50px] px-6 py-2.5 text-[15px] font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-az-green ${PILL[tone]} ${className}`}>{children}</button>;
}

export function StatTile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-[12px] bg-white p-5 shadow-card">
      <p className="text-[34px] font-semibold leading-none text-az-navy">{value}</p>
      <p className="mt-2 text-sm font-medium text-az-text">{label}</p>
      {hint && <p className="mt-1 text-xs text-az-text-muted">{hint}</p>}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="rounded-[12px] border-2 border-dashed border-az-grey-bg bg-white px-6 py-12 text-center">
      <p className="text-lg font-semibold text-az-navy">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-az-text-muted">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Plain table pieces so pages share one look. */
export const Table = ({ children }: { children: ReactNode }) => (
  <div className="overflow-x-auto rounded-[12px] bg-white shadow-card"><table className="w-full min-w-[640px] border-collapse text-left text-sm">{children}</table></div>
);
export const Th = ({ children }: { children?: ReactNode }) => <th scope="col" className="border-b border-az-grey-bg bg-az-grey-bg/60 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-az-navy">{children}</th>;
export const Td = ({ children, className = '' }: { children?: ReactNode; className?: string }) => <td className={`border-b border-az-grey-bg px-4 py-3 align-top text-az-text ${className}`}>{children}</td>;

/** Small synthetic-data notice for pages that show demo content. */
export function SyntheticNote() {
  return <p className="mt-6 text-xs text-az-text-muted">All data on this page is synthetic. Simulated outputs are not decisions.</p>;
}
