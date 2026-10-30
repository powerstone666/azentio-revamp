import { isReviewable, isQueued, isFlagged, IDEA_STATUSES, OFFERINGS, AUDIENCES, PRIORITIES, REASON_CODES, EVIDENCE_QUALITY, REDACTION_RULES } from '@/app/(ui)/components/portal/staff/rules';
import {
  CONSENT_ITEMS, OBSERVATION_TYPES, EVIDENCE_TYPES, currentOrg, ownObservation, isShared, sharedObservations,
  sharedObservation, clientIdeas, clientAuditTime, displayRole,
} from '@/app/(ui)/components/portal/client/shared';
import { OBSERVATIONS, IDEAS, type Observation, type ObsState, type Idea } from '@/app/(config)/mock/portal';
import { ideaStatusSchema, moderationDecisionSchema, ideaCreateSchema } from '@/app/(common-lib)/types/schemas';
import { validIdea } from './support/fixtures';

const obs = (overrides: Partial<Observation>): Observation => ({ ...OBSERVATIONS[0], ...overrides });
const idea = (overrides: Partial<Idea>): Idea => ({ ...IDEAS[0], ...overrides });

describe('staff rules', () => {
  const states: ObsState[] = ['private_draft', 'submitted', 'needs_clarification', 'approved', 'published', 'suspended', 'rejected', 'withdrawn'];

  it.each(states.map((state) => [state, state !== 'private_draft'] as const))('isReviewable(%s) is %s', (state, expected) => {
    expect(isReviewable(obs({ state }))).toBe(expected);
  });

  it.each(states.map((state) => [state, state === 'submitted' || state === 'needs_clarification'] as const))('isQueued(%s) is %s', (state, expected) => {
    expect(isQueued(obs({ state }))).toBe(expected);
  });

  it('treats an observation as flagged only when it has at least one flag reason', () => {
    expect(isFlagged(obs({ flagged: undefined }))).toBe(false);
    expect(isFlagged(obs({ flagged: [] }))).toBe(false);
    expect(isFlagged(obs({ flagged: ['Contains a contact detail'] }))).toBe(true);
  });

  it('keeps idea status, offering, priority and audience options in step with the schemas', () => {
    expect(IDEA_STATUSES).toEqual(ideaStatusSchema.options);
    for (const offering of ['FAI', 'Lending', 'AMLOCK']) expect(OFFERINGS).toContain(offering);
    for (const priority of PRIORITIES) expect(ideaCreateSchema.safeParse({ ...validIdea, priority: priority.toLowerCase() }).success).toBe(true);
    for (const audience of ['Internal', 'Clients']) expect(ideaCreateSchema.safeParse({ ...validIdea, audience: audience.toLowerCase() }).success).toBe(true);
  });

  it('the priority picker offers every priority the idea schema accepts', () => {
    const schemaPriorities = ['low', 'medium', 'high', 'critical'];
    expect(PRIORITIES.map((p) => p.toLowerCase()).sort()).toEqual(schemaPriorities.sort());
  });

  it('every audience the picker offers is accepted by the idea schema', () => {
    for (const audience of AUDIENCES) {
      expect(ideaCreateSchema.safeParse({ ...validIdea, audience: audience.toLowerCase() }).success).toBe(true);
    }
  });

  it('maps every evidence-quality label to a value the moderation schema accepts', () => {
    for (const label of EVIDENCE_QUALITY) {
      const value = label.split(':')[0].toLowerCase();
      expect(moderationDecisionSchema.safeParse({
        action: 'approve', reason_code: 'ok', evidence_quality: value,
      }).success).toBe(true);
    }
  });

  it('has non-empty, unique reason codes and redaction rules', () => {
    expect(new Set(REASON_CODES).size).toBe(REASON_CODES.length);
    for (const rule of [...REASON_CODES, ...REDACTION_RULES]) expect(rule.trim()).not.toBe('');
    expect(REDACTION_RULES.length).toBeGreaterThan(0);
  });
});

describe('client shared helpers', () => {
  it('keeps the consent keys a to e in order, each with a label and hint', () => {
    expect(CONSENT_ITEMS.map((c) => c.key)).toEqual(['a', 'b', 'c', 'd', 'e']);
    for (const item of CONSENT_ITEMS) {
      expect(item.label.trim()).not.toBe('');
      expect(item.hint.trim()).not.toBe('');
    }
  });

  it('lists observation types and evidence types without duplicates', () => {
    expect(new Set(OBSERVATION_TYPES).size).toBe(OBSERVATION_TYPES.length);
    expect(new Set(EVIDENCE_TYPES).size).toBe(EVIDENCE_TYPES.length);
    expect(EVIDENCE_TYPES).toContain('Other');
  });

  it('maps each observation type label to a schema observation_type value', () => {
    const labelToSchema: Record<string, string> = {
      'Market observation': 'market_observation',
      Trend: 'emerging_trend',
      'Operational challenge': 'operational_challenge',
      'Product gap': 'product_gap',
      'Improvement suggestion': 'improvement_suggestion',
      'Successful practice': 'successful_practice',
    };
    expect(Object.keys(labelToSchema).sort()).toEqual([...OBSERVATION_TYPES].sort());
    const schemaValues = Object.values(labelToSchema);
    expect(new Set(schemaValues).size).toBe(schemaValues.length);
  });

  it('uses Harborline as the signed-in preview organisation', () => {
    expect(currentOrg().id).toBe('harborline');
  });

  it('lets the current org see its own observations and 404s on anyone else', () => {
    expect(ownObservation('obs_11').orgId).toBe('harborline');
    expect(() => ownObservation('obs_02')).toThrow();
    expect(() => ownObservation('obs_404')).toThrow();
  });

  it('treats only published community observations as shared', () => {
    expect(isShared(obs({ state: 'published', scope: 'community' }))).toBe(true);
    expect(isShared(obs({ state: 'published', scope: 'org' }))).toBe(false);
    expect(isShared(obs({ state: 'suspended', scope: 'community' }))).toBe(false);
    expect(isShared(obs({ state: 'approved', scope: 'community' }))).toBe(false);
  });

  it('lists every shared observation in the shared-learning feed', () => {
    const ids = sharedObservations().map((o) => o.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.every((id) => isShared(OBSERVATIONS.find((o) => o.id === id)!))).toBe(true);
  });

  it('returns a shared observation by id and 404s for a withdrawn or unknown one', () => {
    expect(sharedObservation('obs_01').id).toBe('obs_01');
    expect(() => sharedObservation('obs_17')).toThrow();
    expect(() => sharedObservation('obs_nope')).toThrow();
  });

  it('returns the time of the last audit entry the client may see', () => {
    expect(clientAuditTime(idea({ audit: [] }))).toBeUndefined();
    expect(clientAuditTime(idea({ audit: [
      { at: '3 days ago', actor: 'A', action: 'Created' },
      { at: '1 day ago', actor: 'A', action: 'Internal', internalOnly: true },
    ] }))).toBe('3 days ago');
    expect(clientAuditTime(idea({ audit: [
      { at: '3 days ago', actor: 'A', action: 'Created' },
      { at: '1 day ago', actor: 'A', action: 'Status changed' },
    ] }))).toBe('1 day ago');
  });

  it('shows clients only client-visible ideas', () => {
    const visible = clientIdeas();
    expect(visible.length).toBeGreaterThan(0);
    expect(visible.every((i) => i.clientVisible)).toBe(true);
    expect(visible.map((i) => i.id)).not.toContain('idea_02');
  });

  it('clientIdeas never returns an internal note', () => {
    // Known leak: clientIdeas() returns whole Idea objects, so internalNote (for example idea_01's roadmap note)
    // reaches the client even though the helper documents that it "never returns internalNote".
    for (const i of clientIdeas()) expect(i).not.toHaveProperty('internalNote');
  });

  it.each([
    ['client_member', 'Client member'],
    ['client_admin', 'Client admin'],
    ['product_owner', 'Product owner'],
    ['portal_admin', 'Portal admin'],
    ['Client member (also in Sandune)', 'Client member'],
    ['Client admin (also in Sandune)', 'Client admin'],
    ['Client member', 'Client member'],
  ])('displayRole(%j) is %j', (input, expected) => {
    expect(displayRole(input)).toBe(expected);
  });

  it('never shows another organisation name through a team role note', () => {
    expect(displayRole('Client member (also in Sandune)')).not.toMatch(/Sandune/);
  });
});
