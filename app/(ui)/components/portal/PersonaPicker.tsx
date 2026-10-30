'use client';

import { useState, useRef, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X, WarningCircle } from '@phosphor-icons/react';
import { ACCESS, PERSONAS, PERSONA_GROUPS, type AccessLevel, type Persona } from '@/app/(config)/personas';
import { PillButton } from '@/app/(ui)/components/portal/kit/ui';
import { destinationFor, setMockPersonaCookie } from '@/app/(ui)/components/portal/signin/mockSession';

const LEVEL: Record<AccessLevel, { label: string; cls: string }> = {
  full: { label: 'Full access', cls: 'bg-az-mint text-az-navy' },
  limited: { label: 'Limited access', cls: 'bg-az-grey-bg text-az-navy' },
  denied: { label: 'Real sign-in would deny', cls: 'border border-az-error bg-white text-az-error' },
};

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

function AccessList({ title, items, tone }: { title: string; items: string[]; tone: 'can' | 'cannot' }) {
  const can = tone === 'can';
  const Icon = can ? Check : X;
  return (
    <div className={`rounded-[10px] p-4 ${can ? 'bg-az-mint-tint' : 'bg-red-50'}`}>
      <p className={`flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-wider ${can ? 'text-az-navy' : 'text-az-error'}`}>
        <Icon size={14} weight="bold" aria-hidden /> {title}
      </p>
      <ul className="mt-2.5 space-y-2">
        {items.map((t) => (
          <li key={t} className="flex gap-2.5 text-[14px] leading-snug text-az-text">
            <Icon size={15} weight="bold" className={`mt-0.5 shrink-0 ${can ? 'text-az-green' : 'text-az-error'}`} aria-hidden />
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PersonaCard({ persona: p, onChoose }: { persona: Persona; onChoose: () => void }) {
  const a = ACCESS[p.email];
  const full = a?.level === 'full';
  const denied = a?.level === 'denied';
  return (
    <div
      className={`overflow-hidden rounded-[12px] border bg-white shadow-card ${
        full ? 'border-az-green' : denied ? 'border-az-error/40' : 'border-az-grey-bg'
      }`}
    >
      <div className="flex flex-wrap items-center gap-4 p-5">
        <span
          aria-hidden
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold ${
            full ? 'bg-az-mint text-az-navy' : 'bg-az-navy text-white'
          }`}
        >
          {initials(p.name)}
        </span>
        <div className="min-w-[11rem] flex-1">
          <h5 className="text-[18px] font-semibold leading-tight text-az-navy">{p.name}</h5>
          <p className="mt-0.5 text-[14px] text-az-text">
            {p.role}
            {p.org && p.org !== 'None' ? <span className="text-az-text-muted"> · {p.org}</span> : null}
          </p>
        </div>
        {a && <span className={`whitespace-nowrap rounded-[50px] px-3.5 py-1.5 text-[13px] font-semibold ${LEVEL[a.level].cls}`}>{LEVEL[a.level].label}</span>}
      </div>

      {a && (
        <div className="border-t border-az-grey-bg px-5 pb-5 pt-4">
          <p className="text-[15px] leading-relaxed text-az-text">{a.summary}</p>
          <div className="mt-4 space-y-3">
            <AccessList title="Can" items={a.can} tone="can" />
            <AccessList title="Cannot" items={a.cannot} tone="cannot" />
          </div>
        </div>
      )}

      <div className="border-t border-az-grey-bg bg-az-grey-bg/50 px-5 py-3">
        <button
          type="button"
          onClick={onChoose}
          className="cursor-pointer text-[14px] font-semibold text-az-navy underline-offset-4 hover:underline active:scale-[0.98] transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-az-green"
        >
          {denied ? `Try signing in as ${p.name.split(' ')[0]}` : `Sign in as ${p.name.split(' ')[0]} →`}
        </button>
      </div>
    </div>
  );
}

export default function PersonaPicker() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  function scrollToInput() {
    if (inputRef.current) {
      inputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      inputRef.current.focus({ preventScroll: true });
    }
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function signInAs(persona: Persona) {
    const access = ACCESS[persona.email];
    if (access?.level === 'denied') {
      setEmail(persona.email);
      setError(access.summary);
      scrollToInput();
      return;
    }
    setError(null);
    setMockPersonaCookie(persona.email);
    router.push(destinationFor(persona));
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const normalised = email.trim().toLowerCase();
    if (!normalised) {
      setError('Enter a work email address');
      scrollToInput();
      return;
    }

    const persona = PERSONAS.find((p) => p.email === normalised);

    if (persona) {
      signInAs(persona);
      return;
    }

    // Edge case: unprovisioned @azentio.com email typed in
    if (normalised.endsWith('@azentio.com')) {
      setError('Verified @azentio.com email but not provisioned. Real sign-in denies the portal.');
      scrollToInput();
      return;
    }

    setError('Couldn’t find your account. Choose a demo persona below.');
    scrollToInput();
  }

  return (
    <div>
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-az-navy">
            Work email
          </label>
          <input
            ref={inputRef}
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            placeholder="you@azentio.com"
            autoComplete="email"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'email-error' : undefined}
            className={`w-full rounded-[12px] border px-4 py-3 text-[15px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${
              error
                ? 'border-az-error bg-white text-az-navy focus-visible:outline-az-error'
                : 'border-az-grey-bg bg-az-grey-bg text-az-text placeholder:text-az-text-muted focus-visible:outline-az-green'
            }`}
          />
          {error && (
            <div id="email-error" className="mt-2 flex items-start gap-1.5 text-sm font-medium text-az-error">
              <WarningCircle size={16} weight="fill" className="mt-0.5 shrink-0" aria-hidden />
              <span>{error}</span>
            </div>
          )}
        </div>
        <PillButton tone="mint" type="submit" className="w-full justify-center">
          Sign in
        </PillButton>
        <p className="text-sm leading-relaxed text-az-text-muted">
          Demo only: choosing a persona opens the portal with synthetic identity and workspace data. Use Real login for an email code backed by the provisioned workspace database.
        </p>
      </form>

      <h3 className="mt-10 text-[18px] font-semibold text-az-navy">Demo personas</h3>
      <p className="mt-1 text-sm text-az-text-muted">
        Synthetic identities. Choose one to sign in as that persona. Only the portal admin has full access; every other persona is limited to what its role needs, as listed on its card.
      </p>

      {PERSONA_GROUPS.map((group) => {
        const people = PERSONAS.filter((p) => p.group === group).sort(
          (a, b) => Number(ACCESS[b.email]?.level === 'full') - Number(ACCESS[a.email]?.level === 'full'),
        );
        return (
          <section key={group} className="mt-8">
            <h4 className="text-[13px] font-semibold uppercase tracking-wider text-az-text-muted">{group}</h4>
            <ul className="mt-3 space-y-4">
              {people.map((p) => (
                <li key={p.email}>
                  <PersonaCard
                    persona={p}
                    onChoose={() => {
                      setEmail(p.email);
                      signInAs(p);
                    }}
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
