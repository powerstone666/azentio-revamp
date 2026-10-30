/** Vertical status history for one idea. Plain data in, no interaction. */
export function AuditTimeline({ entries }: { entries: { action: string; actor: string; at: Date | string }[] }) {
  return (
    <ol className="relative ml-2 space-y-5 border-l-2 border-az-mint pl-6">
      {entries.map((e, i) => (
        <li key={`${e.at}-${i}`} className="relative">
          <span aria-hidden className="absolute -left-[31px] top-1 block h-3 w-3 rounded-full bg-az-green" />
          <p className="text-sm font-semibold text-az-navy">{e.action}</p>
          <p className="text-sm text-az-text">{e.actor}</p>
          <p className="text-xs text-az-text-muted">{new Date(e.at).toLocaleString()}</p>
        </li>
      ))}
    </ol>
  );
}
