'use client';

import { useState } from 'react';

type Team = {
  id: string; name: string; description: string; status: string; created_at?: string | Date;
  creator: string; member_count: number; is_member: boolean; my_role: string | null;
};
type Post = { id: string; body: string; author: string; created_at: string | Date };

export function HackathonTeams({ initialTeams }: { initialTeams: Team[] }) {
  const [teams, setTeams] = useState(initialTeams);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [postBody, setPostBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function refresh() {
    const response = await fetch('/api/v1/employee/hackathon-teams', { cache: 'no-store' });
    const result = await response.json();
    if (response.ok) setTeams(result.data as Team[]);
  }

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/v1/employee/hackathon-teams', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, description }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Unable to create team.');
      setName(''); setDescription(''); await refresh(); setMessage('Team space created.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to create team.'); }
    finally { setBusy(false); }
  }

  async function membership(team: Team) {
    setBusy(true); setMessage('');
    try {
      const response = await fetch(`/api/v1/employee/hackathon-teams/${team.id}/members`, { method: team.is_member ? 'DELETE' : 'POST' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Unable to update team membership.');
      await refresh();
      if (team.is_member && selected === team.id) { setSelected(null); setPosts([]); }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to update team membership.'); }
    finally { setBusy(false); }
  }

  async function openSpace(teamId: string) {
    setBusy(true); setMessage('');
    try {
      const response = await fetch(`/api/v1/employee/hackathon-teams/${teamId}/posts`, { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Unable to open this team space.');
      setPosts(result.data as Post[]); setSelected(teamId);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to open team space.'); }
    finally { setBusy(false); }
  }

  async function post(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected) return;
    setBusy(true); setMessage('');
    try {
      const response = await fetch(`/api/v1/employee/hackathon-teams/${selected}/posts`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: postBody }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Unable to post update.');
      setPosts((current) => [result.data as Post, ...current]); setPostBody('');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to post update.'); }
    finally { setBusy(false); }
  }

  return <div className="grid items-start gap-6 lg:grid-cols-[0.8fr_1.2fr]">
    <section className="rounded-2xl bg-white p-5 shadow-card">
      <h2 className="text-lg font-semibold text-az-navy">Start a team space</h2>
      <p className="mt-1 text-sm text-az-text-muted">Team spaces and updates are visible only to verified Azentio employees.</p>
      <form onSubmit={create} className="mt-4 grid gap-3">
        <label className="text-sm font-semibold text-az-navy">Team name<input required minLength={3} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded-xl border border-az-grey-bg px-4 py-2.5 font-normal" /></label>
        <label className="text-sm font-semibold text-az-navy">Project overview<textarea required minLength={10} maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1 min-h-24 w-full rounded-xl border border-az-grey-bg px-4 py-2.5 font-normal" /></label>
        <button type="submit" disabled={busy} className="w-fit rounded-full bg-az-mint px-5 py-2 text-sm font-semibold text-az-navy disabled:opacity-50">Create team</button>
      </form>
    </section>
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-az-navy">Open team spaces</h2>
      {teams.length === 0 ? <div className="rounded-2xl bg-white p-5 text-sm text-az-text-muted">No open teams yet. Start one to invite internal collaboration.</div> : teams.map((team) => <article key={team.id} className="rounded-2xl bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-az-navy">{team.name}</h3><p className="mt-2 whitespace-pre-wrap text-sm text-az-text">{team.description}</p></div><span className="rounded-full bg-az-grey-bg px-3 py-1 text-xs capitalize text-az-navy">{team.status}</span></div>
        <p className="mt-3 text-xs text-az-text-muted">Started by {team.creator} · {team.member_count} {team.member_count === 1 ? 'member' : 'members'}{team.my_role ? ` · ${team.my_role}` : ''}</p>
        <div className="mt-4 flex flex-wrap gap-3">{team.is_member ? <><button type="button" disabled={busy} onClick={() => void openSpace(team.id)} className="rounded-full bg-az-navy px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">Open team space</button><button type="button" disabled={busy} onClick={() => void membership(team)} className="rounded-full border border-az-grey-bg px-5 py-2 text-sm font-semibold text-az-navy disabled:opacity-50">Leave team</button></> : team.status === 'open' && <button type="button" disabled={busy} onClick={() => void membership(team)} className="rounded-full bg-az-mint px-5 py-2 text-sm font-semibold text-az-navy disabled:opacity-50">Join team</button>}</div>
        {selected === team.id && <div className="mt-5 border-t border-az-grey-bg pt-4"><h4 className="font-semibold text-az-navy">Team updates</h4><form onSubmit={post} className="mt-3 grid gap-2"><label htmlFor={`team-post-${team.id}`} className="text-xs font-semibold text-az-navy">Share a progress update</label><textarea id={`team-post-${team.id}`} required maxLength={4000} value={postBody} onChange={(event) => setPostBody(event.target.value)} className="min-h-20 rounded-xl border border-az-grey-bg px-4 py-3 text-sm" /><button type="submit" disabled={busy} className="w-fit rounded-full bg-az-mint px-4 py-2 text-xs font-semibold text-az-navy disabled:opacity-50">Post update</button></form><ul className="mt-4 space-y-3">{posts.map((item) => <li key={item.id} className="rounded-xl bg-az-grey-bg/50 p-3"><p className="whitespace-pre-wrap text-sm text-az-text">{item.body}</p><p className="mt-2 text-xs text-az-text-muted">{item.author} · {new Date(item.created_at).toLocaleString()}</p></li>)}</ul>{posts.length === 0 && <p className="mt-3 text-sm text-az-text-muted">No updates yet.</p>}</div>}
      </article>)}
      {message && <p role="status" className="text-sm text-az-text-muted">{message}</p>}
    </section>
  </div>;
}
