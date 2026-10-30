import type { ReactNode } from 'react';

/** Explains that a control is disabled because this is a preview build. */
export function PreviewNote({ children = 'Preview build: nothing is saved.' }: { children?: ReactNode }) {
  return <p className="rounded-[12px] border border-az-grey-bg bg-az-grey-bg/60 px-4 py-3 text-sm text-az-text">{children}</p>;
}
