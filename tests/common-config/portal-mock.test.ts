import {
  ORGS, orgById, OBSERVATIONS, getObservation, observationsOf, THEMES, getTheme, IDEAS, getIdea,
  REPORTS, AUDIT, DEMOS, demosFor, SESSIONS, TEAM, STATE_LABEL, SCOPE_LABEL, type ObsState,
} from '@/app/(config)/mock/portal';
import { PERSONAS } from '@/app/(config)/personas';
import { isShared } from '@/app/(ui)/components/portal/client/shared';

const orgIds = new Set(ORGS.map((o) => o.id));
const obsIds = new Set(OBSERVATIONS.map((o) => o.id));

describe('ORGS', () => {
  it('has unique ids and names', () => {
    expect(new Set(ORGS.map((o) => o.id)).size).toBe(ORGS.length);
    expect(new Set(ORGS.map((o) => o.name)).size).toBe(ORGS.length);
  });

  it('only uses client or azentio kinds, and azentio is the only internal org', () => {
    for (const org of ORGS) expect(['client', 'azentio']).toContain(org.kind);
    expect(ORGS.filter((o) => o.kind === 'azentio').map((o) => o.id)).toEqual(['azentio']);
  });

  it('gives Emberfield no entitlements and gives every other client at least one offering', () => {
    expect(orgById('emberfield')?.offerings).toEqual([]);
    for (const org of ORGS.filter((o) => o.kind === 'client' && o.id !== 'emberfield')) {
      expect(org.offerings.length).toBeGreaterThan(0);
    }
  });

  it('looks up orgs by id and returns undefined for an unknown id', () => {
    expect(orgById('harborline')?.name).toBe('Harborline Commercial Bank');
    expect(orgById('nope')).toBeUndefined();
  });

  it('names the org of every persona who belongs to a mock org', () => {
    const names = new Set(ORGS.map((o) => o.name));
    for (const persona of PERSONAS.filter((p) => p.org !== 'Azentio' && p.org !== 'None' && !p.org.includes('+'))) {
      expect(names.has(persona.org)).toBe(true);
    }
  });
});

describe('OBSERVATIONS referential integrity', () => {
  it('has unique ids', () => {
    expect(new Set(OBSERVATIONS.map((o) => o.id)).size).toBe(OBSERVATIONS.length);
  });

  it.each(OBSERVATIONS.map((o) => [o.id, o] as const))('%s belongs to an existing org', (_id, obs) => {
    expect(orgIds.has(obs.orgId)).toBe(true);
  });

  it.each(OBSERVATIONS.map((o) => [o.id, o] as const))('%s uses a known state label and scope', (_id, obs) => {
    expect(STATE_LABEL[obs.state as ObsState]).toBeDefined();
    expect(Object.keys(SCOPE_LABEL)).toContain(obs.scope === 'community' ? 'community' : obs.scope);
  });

  it.each(OBSERVATIONS.map((o) => [o.id, o] as const))('%s has a version of at least 1', (_id, obs) => {
    expect(obs.version).toBeGreaterThanOrEqual(1);
  });

  it('keeps private drafts private and private-scope items as drafts', () => {
    for (const obs of OBSERVATIONS) {
      if (obs.state === 'private_draft') expect(obs.scope).toBe('private');
      if (obs.scope === 'private') expect(obs.state).toBe('private_draft');
    }
  });

  it('only publishes community-scoped items with consent to store and to publish a reviewed copy', () => {
    for (const obs of OBSERVATIONS.filter((o) => o.state === 'published')) {
      expect(obs.scope).toBe('community');
      expect(obs.consents.a).toBe(true);
      expect(obs.consents.b).toBe(true);
    }
  });

  it('attaches flags only to queued (submitted) items', () => {
    for (const obs of OBSERVATIONS.filter((o) => o.flagged?.length)) {
      expect(obs.state).toBe('submitted');
    }
  });

  it("keeps shared copies free of the author and organisation names", () => {
    for (const obs of OBSERVATIONS.filter((o) => o.shared)) {
      const org = orgById(obs.orgId)!;
      expect(obs.shared).not.toContain(obs.author);
      expect(obs.shared).not.toContain(org.name);
      expect(obs.shared).not.toContain(org.short);
    }
  });

  it('never ships raw source text as the shared copy', () => {
    for (const obs of OBSERVATIONS.filter((o) => o.shared && o.source)) {
      expect(obs.shared).not.toBe(obs.source);
    }
  });

  it('gives each author who is a persona the same organisation as the observation', () => {
    for (const obs of OBSERVATIONS) {
      const persona = PERSONAS.find((p) => p.name === obs.author);
      if (!persona) continue;
      expect(persona.org).toBe(orgById(obs.orgId)!.name);
    }
  });

  it('reports which shared observations are in the community feed', () => {
    const shared = OBSERVATIONS.filter(isShared).map((o) => o.id);
    expect(shared).toEqual(expect.arrayContaining(['obs_01', 'obs_02', 'obs_03', 'obs_04', 'obs_07', 'obs_08', 'obs_18']));
    expect(shared).not.toContain('obs_12');
    expect(shared).not.toContain('obs_19');
  });

  it('looks up observations and org observations by id', () => {
    expect(getObservation('obs_01')?.title).toMatch(/Seasonal/);
    expect(getObservation('obs_99')).toBeUndefined();
    expect(observationsOf('harborline').every((o) => o.orgId === 'harborline')).toBe(true);
    expect(observationsOf('emberfield')).toEqual([]);
  });
});

describe('THEMES', () => {
  it('has unique ids and evidence that exists', () => {
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(THEMES.length);
    for (const theme of THEMES) for (const id of theme.evidence) expect(obsIds.has(id)).toBe(true);
  });

  it('cites only shared observations as evidence', () => {
    for (const theme of THEMES) {
      for (const id of theme.evidence) expect(isShared(getObservation(id)!)).toBe(true);
    }
  });

  it.each(THEMES.map((t) => [t.id, t] as const))('%s is shown only when at least three organisations contribute', (_id, theme) => {
    expect(theme.shown).toBe(theme.orgs >= 3);
  });

  it('counts at least as many posts as it cites as evidence', () => {
    for (const theme of THEMES) expect(theme.posts).toBeGreaterThanOrEqual(theme.evidence.length);
  });

  it('looks up themes by id', () => {
    expect(getTheme('theme_seasonality')?.offering).toBe('FAI');
    expect(getTheme('theme_none')).toBeUndefined();
  });

  it('theme_collections counts the two organisations represented by its cited evidence', () => {
    const theme = getTheme('theme_collections')!;
    const evidenceOrgs = new Set(theme.evidence.map((id) => getObservation(id)!.orgId));
    expect(evidenceOrgs.size).toBe(theme.orgs);
  });
});

describe('IDEAS', () => {
  it('has unique ids and an owner for every idea', () => {
    expect(new Set(IDEAS.map((i) => i.id)).size).toBe(IDEAS.length);
    for (const idea of IDEAS) expect(idea.owner.trim()).not.toBe('');
  });

  it('cites only existing observations as evidence', () => {
    for (const idea of IDEAS) for (const id of idea.evidence) expect(obsIds.has(id)).toBe(true);
  });

  it('only shows client-visible ideas whose evidence is shared learning', () => {
    for (const idea of IDEAS.filter((i) => i.clientVisible)) {
      for (const id of idea.evidence) expect(isShared(getObservation(id)!)).toBe(true);
    }
  });

  it('hides ideas with no shared evidence from clients', () => {
    expect(getIdea('idea_02')?.clientVisible).toBe(false);
    expect(getIdea('idea_02')?.evidence).toEqual([]);
  });

  it('keeps audit entries in chronological order (oldest first, so "days ago" never increases)', () => {
    for (const idea of IDEAS) {
      const ages = idea.audit.map((e) => Number(e.at.match(/^(\d+)/)?.[1] ?? 0));
      expect(ages).toEqual([...ages].sort((a, b) => b - a));
    }
  });

  it('looks up ideas by id', () => {
    expect(getIdea('idea_01')?.status).toBe('Under review');
    expect(getIdea('idea_99')).toBeUndefined();
  });
});

describe('REPORTS and AUDIT', () => {
  it('has unique report ids', () => {
    expect(new Set(REPORTS.map((r) => r.id)).size).toBe(REPORTS.length);
  });

  it('links each report to an observation that exists or to a comment on one', () => {
    for (const report of REPORTS) {
      const target = report.target.replace(/^Comment on /, '');
      expect(obsIds.has(target)).toBe(true);
    }
  });

  it('links each audit entry to an existing target when the target is an observation', () => {
    for (const entry of AUDIT) {
      if (entry.target.startsWith('obs_')) expect(obsIds.has(entry.target)).toBe(true);
    }
  });

  it('gives every audit entry a request id and an actor', () => {
    for (const entry of AUDIT) {
      expect(entry.request).toMatch(/^req_[0-9a-f]+$/);
      expect(entry.actor.trim()).not.toBe('');
    }
  });

  it('only reports an observation as misleading when it is suspended or open for moderation', () => {
    const misleading = REPORTS.filter((r) => r.category === 'Misleading');
    for (const report of misleading) expect(getObservation(report.target)?.state).toBe('suspended');
  });

  it('rpt_02 points at an observation that exists in the mock data', () => {
    const target = REPORTS.find((r) => r.id === 'rpt_02')!.target;
    expect(obsIds.has(target)).toBe(true);
  });
});

describe('DEMOS and sessions', () => {
  it('has unique demo ids', () => {
    expect(new Set(DEMOS.map((d) => d.id)).size).toBe(DEMOS.length);
  });

  it('lists the org names that actually hold each demo offering in its audience', () => {
    const expected: Record<string, string[]> = {
      fai: ['Harborline', 'Sandune', 'Kestrel'],
      lending: ['Harborline', 'Sandune', 'Kestrel'],
      'amlock-tm': ['Harborline'],
      claims: ['Northmere'],
    };
    for (const demo of DEMOS) {
      const holders = ORGS.filter((o) => o.kind === 'client' && o.offerings.includes(demo.offering)).map((o) => o.short);
      expect(holders.sort()).toEqual(expected[demo.id].sort());
      expect(demo.audience.split(', ').sort()).toEqual(expected[demo.id].sort());
    }
  });

  it('shows Emberfield no demos and Harborline the demos for its four offerings', () => {
    expect(demosFor(orgById('emberfield')!)).toEqual([]);
    expect(demosFor(orgById('harborline')!).map((d) => d.id).sort()).toEqual(['amlock-tm', 'fai', 'lending']);
  });

  it('gives every session a status the UI knows about and a unique id', () => {
    expect(new Set(SESSIONS.map((s) => s.id)).size).toBe(SESSIONS.length);
    for (const session of SESSIONS) expect(['Live', 'Upcoming', 'Recording']).toContain(session.status);
  });

  it('keeps the team list free of duplicate emails', () => {
    const emails = TEAM.map((m) => m.email);
    expect(new Set(emails).size).toBe(emails.length);
  });
});

describe('labels', () => {
  it('labels every observation state', () => {
    const states: ObsState[] = ['private_draft', 'submitted', 'needs_clarification', 'approved', 'published', 'suspended', 'rejected', 'withdrawn'];
    expect(Object.keys(STATE_LABEL).sort()).toEqual([...states].sort());
    for (const state of states) expect(STATE_LABEL[state].trim()).not.toBe('');
  });

  it('labels the three scopes', () => {
    expect(Object.keys(SCOPE_LABEL).sort()).toEqual(['community', 'org', 'private']);
  });
});
