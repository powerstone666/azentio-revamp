import { CheckCircle } from '@phosphor-icons/react/ssr';
import SigninGeometry from './SigninGeometry';

const POINTS = [
  'Azentio employees sign in with their work email.',
  'Clients sign in with the address their invitation was sent to.',
  'What you can see depends on your role and your workspace.',
];

const STEPS = [
  { title: 'For now, choose a demo persona', text: 'Pick any persona in the list. You are signed in as that person and land in their area of the portal.' },
  { title: 'Real email sign-in comes later', text: 'When it is switched on, you will enter your work email and a one-time code. We will explain exactly how it works here.' },
];

export function BrandPanel() {
  return (
    <section className="relative overflow-x-clip bg-az-navy px-5 py-12 text-white md:px-12 lg:px-16 lg:py-20">
      <SigninGeometry />
      <div className="relative">
        <h1 className="text-[32px] font-semibold leading-tight md:text-[40px]">
          Sign in to <span className="border-b-[3px] border-az-mint pb-1">azentio.ai</span>
        </h1>
        <ul className="mt-8 space-y-4">
          {POINTS.map((point) => (
            <li key={point} className="flex gap-3 text-[16px] leading-relaxed text-white/90">
              <CheckCircle size={22} weight="fill" className="mt-0.5 shrink-0 text-az-green" aria-hidden="true" />
              <span>{point}</span>
            </li>
          ))}
        </ul>

        <div className="relative z-10 mt-10 max-w-[520px] rounded-[12px] border border-white/15 bg-[#1f3b4a] p-6 shadow-card">
          <h2 className="text-[20px] font-semibold">How to sign in</h2>
          <ol className="mt-4 space-y-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-az-mint text-sm font-semibold text-az-navy">{i + 1}</span>
                <div>
                  <p className="font-semibold">{s.title}</p>
                  <p className="mt-1 text-[15px] leading-relaxed text-white/75">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-5 text-xs text-white/55">These instructions will be updated when real sign-in is enabled.</p>
        </div>
      </div>
    </section>
  );
}
