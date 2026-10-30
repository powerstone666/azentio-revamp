import Link from 'next/link';
import type { ReactNode } from 'react';

export function Container({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1240px] px-5 md:px-8 ${className}`}>{children}</div>;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="inline-flex items-center gap-2 font-medium text-xs uppercase tracking-[0.18em] text-accent-strong">
      <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
      {children}
    </p>
  );
}

const BUTTON = {
  primary: 'bg-accent text-on-accent shadow-[0_8px_30px_-8px_var(--glow)] hover:brightness-105',
  ghost: 'border border-line bg-surface/70 text-ink hover:border-accent-strong hover:bg-surface',
};

export function ButtonLink({
  href,
  children,
  variant = 'primary',
  className = '',
}: {
  href: string;
  children: ReactNode;
  variant?: keyof typeof BUTTON;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`focus-ring inline-flex items-center gap-2 rounded-full px-6 py-3 text-[15px] font-semibold transition ${BUTTON[variant]} ${className}`}
    >
      {children}
    </Link>
  );
}
