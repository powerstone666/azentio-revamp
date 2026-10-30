import { Card, SyntheticNote } from '@/app/(ui)/components/portal/kit/ui';
import { Pill } from '@/app/(ui)/components/portal/kit/Status';
import type { ReleaseNote } from '@/app/api/(services)/releases/service';

export function ClientReleaseNoteList({ notes, demo = false }: { notes: ReleaseNote[]; demo?: boolean }) {
  if (demo) return <>
    <Card><Pill tone="mint">Client update</Pill><h2 className="mt-4 text-lg font-semibold text-az-navy">Sample product update</h2><p className="mt-3 text-sm leading-relaxed text-az-text">Entitled clients receive reviewed product notes here. This synthetic note is shown only in demo preview.</p><p className="mt-4 text-xs text-az-text-muted">Demo preview</p></Card>
    <SyntheticNote />
  </>;
  if (notes.length === 0) return <Card><p className="text-sm text-az-text-muted">No release notes are currently available for this workspace’s published offerings.</p></Card>;
  return <div className="grid gap-5 md:grid-cols-2">{notes.map((note) => <Card key={note.id}>
    <div className="flex flex-wrap items-start justify-between gap-3"><h2 className="text-lg font-semibold text-az-navy">{note.title}</h2><Pill tone="mint">Client update</Pill></div>
    {note.offering_id && <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-az-text-muted">{note.offering_id}</p>}
    <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-az-text">{note.body}</p>
    <p className="mt-4 text-xs text-az-text-muted">Published {new Date(note.published_at).toLocaleDateString()}</p>
  </Card>)}</div>;
}
