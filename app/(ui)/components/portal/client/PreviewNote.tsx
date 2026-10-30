import { PREVIEW_NOTE } from './shared';

/** Honest notice beside any control that would save, submit, withdraw or invite. */
export function PreviewNote({ text = PREVIEW_NOTE }: { text?: string }) {
  return (
    <p role="note" className="rounded-[12px] bg-az-mint-tint px-4 py-3 text-sm text-az-navy">
      {text}
    </p>
  );
}
