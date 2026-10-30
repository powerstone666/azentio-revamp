import { Card, SyntheticNote } from '@/app/(ui)/components/portal/kit/ui';
import { Pill } from '@/app/(ui)/components/portal/kit/Status';
import type { ReleaseNote } from '@/app/api/(services)/releases/service';

export function ReleaseNoteList({ notes, demo = false }: { notes: ReleaseNote[]; demo?: boolean }) {
  if (demo) return <>
    <Card><Pill tone="navy">Employees only</Pill><h2 className="mt-4 text-lg font-semibold text-az-navy">Sample release note</h2><p className="mt-3 text-sm leading-relaxed text-az-text">Internal prototype updates are shared with verified employees after review. This example is synthetic.</p><p className="mt-4 text-xs text-az-text-muted">Demo preview</p></Card>
    <SyntheticNote />
  </>;
  if (notes.length === 0) return <Card><p className="text-sm text-az-text-muted">No employee release notes have been published yet.</p></Card>;
  return <div className="grid gap-5 md:grid-cols-2">{notes.map((note) => <Card key={note.id}>
    <div className="flex flex-wrap items-start justify-between gap-3"><h2 className="text-lg font-semibold text-az-navy">{note.title}</h2><Pill tone="navy">Employees only</Pill></div>
    {note.offering_id && <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-az-text-muted">{note.offering_id}</p>}
    <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-az-text">{note.body}</p>
    <p className="mt-4 text-xs text-az-text-muted">Published {new Date(note.published_at).toLocaleDateString()}</p>
  </Card>)}</div>;
}
