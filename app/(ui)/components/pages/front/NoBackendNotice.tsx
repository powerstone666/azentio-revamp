import { Info } from '@phosphor-icons/react/ssr';

// Shown after a form passes validation. This build has no backend, so it must never claim the data was sent or stored.
export default function NoBackendNotice({ onReset }: { onReset: () => void }) {
  return (
    <div role="status" className="rounded-3xl border border-line bg-az-mint-tint p-6 md:p-8">
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-on-accent">
          <Info size={24} weight="duotone" aria-hidden />
        </span>
        <div>
          <p className="text-lg font-semibold text-az-navy">
            Thanks. This demo build checked your form but does not send or store anything.
          </p>
          <button
            type="button"
            onClick={onReset}
            className="focus-ring mt-5 rounded-full border border-az-navy/30 px-5 py-2 text-sm font-semibold text-az-navy transition hover:border-az-navy"
          >
            Start again
          </button>
        </div>
      </div>
    </div>
  );
}
