'use client';

import { useState } from 'react';
import PersonaPicker from '@/app/(ui)/components/portal/PersonaPicker';
import { RealLogin } from './RealLogin';

export function LoginModes() {
  const [mode, setMode] = useState<'demo' | 'real'>('real');
  return (
    <>
      <div role="tablist" aria-label="Sign-in mode" className="mb-7 grid grid-cols-2 rounded-full bg-az-grey-bg p-1">
        <button type="button" role="tab" aria-selected={mode === 'demo'} onClick={() => setMode('demo')} className={`rounded-full px-4 py-2.5 text-sm font-semibold transition-colors ${mode === 'demo' ? 'bg-white text-az-navy shadow-sm' : 'text-az-text-muted hover:text-az-navy'}`}>Demo login</button>
        <button type="button" role="tab" aria-selected={mode === 'real'} onClick={() => setMode('real')} className={`rounded-full px-4 py-2.5 text-sm font-semibold transition-colors ${mode === 'real' ? 'bg-white text-az-navy shadow-sm' : 'text-az-text-muted hover:text-az-navy'}`}>Real login</button>
      </div>
      <div role="tabpanel" aria-label={mode === 'demo' ? 'Demo login' : 'Real login'}>
        {mode === 'demo' ? <PersonaPicker /> : <RealLogin />}
      </div>
    </>
  );
}
