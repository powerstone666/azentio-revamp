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
          <section key={group} className="mt-6">
            <h4 className="text-sm font-semibold text-az-navy">{group}</h4>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {people.map((p) => {
                const a = ACCESS[p.email];
                const full = a?.level === 'full';
                const isDenied = a?.level === 'denied';
                return (
                  <li key={p.email} className={full ? 'sm:col-span-2' : undefined}>
                    <button
                      type="button"
                      onClick={() => {
                        setEmail(p.email);
                        signInAs(p);
                      }}
                      className={`flex h-full w-full flex-col items-stretch justify-start rounded-[12px] border p-4 text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-az-green ${
                        full
                          ? 'border-az-green bg-az-mint-tint'
                          : isDenied
                            ? 'border-az-grey-bg bg-white hover:border-az-error hover:bg-red-50/20'
                            : 'border-az-grey-bg bg-white hover:border-az-green hover:bg-az-mint-tint'
                      }`}
                    >
                      <span className="flex flex-wrap items-start justify-between gap-2">
                        <span>
                          <span className={`block font-semibold text-az-navy ${full ? 'text-[17px]' : 'text-[15px]'}`}>{p.name}</span>
                          <span className="block text-sm font-medium text-az-text">{p.role}</span>
                          {p.org && p.org !== 'None' && <span className="block text-sm text-az-text-muted">{p.org}</span>}
                        </span>
                        {a && <span className={`whitespace-nowrap rounded-[50px] px-3 py-1 text-xs font-semibold ${LEVEL[a.level].cls}`}>{LEVEL[a.level].label}</span>}
                      </span>
                      {a && (
                        <>
                          <span className="mt-2 block text-sm leading-relaxed text-az-text">{a.summary}</span>
                          <span className={`mt-3 grid gap-3 ${full ? 'md:grid-cols-2' : ''}`}>
                            <span className="block">
                              <span className="block text-xs font-semibold uppercase tracking-wider text-az-navy">Can</span>
                              {a.can.map((t) => (
                                <span key={t} className="mt-1 flex gap-2 text-[13px] leading-snug text-az-text">
                                  <Check size={14} weight="bold" className="mt-0.5 shrink-0 text-az-green" aria-hidden />{t}
                                </span>
                              ))}
                            </span>
                            <span className="block">
                              <span className="block text-xs font-semibold uppercase tracking-wider text-az-navy">Cannot</span>
                              {a.cannot.map((t) => (
                                <span key={t} className="mt-1 flex gap-2 text-[13px] leading-snug text-az-text">
                                  <X size={14} weight="bold" className="mt-0.5 shrink-0 text-az-error" aria-hidden />{t}
                                </span>
                              ))}
                            </span>
                          </span>
                        </>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
