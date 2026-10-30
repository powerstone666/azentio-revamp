/** Static filter chips. They show the intended look; they do not filter in this preview. */
export function FilterChips({ items, active }: { items: string[]; active: string }) {
  return (
    <div className="flex flex-wrap gap-2" aria-label="Filters (not active in this preview)">
      {items.map((item) => (
        <span
          key={item}
          className={`rounded-[50px] border px-4 py-1.5 text-sm font-medium ${
            item === active ? 'border-az-navy bg-az-navy text-white' : 'border-az-grey-bg bg-white text-az-text'
          }`}
        >
          {item}
        </span>
      ))}
    </div>
  );
}
