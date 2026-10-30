jest.mock('@/app/api/(db)/client', () => ({
  query: jest.fn(), queryOne: jest.fn(), transaction: jest.fn(), default: {},
}));

import { query, queryOne, transaction } from '@/app/api/(db)/client';
import { mockDb } from '../support/db';
import { hackathonTeamCreateSchema, hackathonTeamPostSchema } from '@/app/(common-lib)/types/schemas';
import {
  createHackathonTeam,
  createHackathonTeamPost,
  joinHackathonTeam,
  leaveHackathonTeam,
  listHackathonTeamPosts,
  listHackathonTeams,
} from '@/app/api/(services)/employee/teams';

const USER = 'user-1';
const OTHER = 'user-2';
const ORG = 'org-azentio';
const TEAM = 'team-1';

type SqlCall = [string, unknown[]?];
const sqlCalls = () => query.mock.calls as SqlCall[];

beforeEach(() => {
  query.mockReset();
  queryOne.mockReset();
  transaction.mockReset();
  mockDb({ query, queryOne, transaction });
});

describe('hackathon team input schemas', () => {
  it.each([
    ['a valid name and description', { name: 'Credit Crew', description: 'We build credit risk tools.' }, true],
    ['a name shorter than 3 characters after trimming', { name: '  ab ', description: 'We build credit risk tools.' }, false],
    ['a name longer than 100 characters', { name: 'x'.repeat(101), description: 'We build credit risk tools.' }, false],
    ['a description shorter than 10 characters', { name: 'Credit Crew', description: 'Too short' }, false],
    ['an unknown extra field', { name: 'Credit Crew', description: 'We build credit risk tools.', org_id: 'x' }, false],
  ])('team create accepts or rejects %s as expected', (_label, input, ok) => {
    expect(hackathonTeamCreateSchema.safeParse(input).success).toBe(ok);
  });

  it.each([
    ['a non-empty post', { body: 'Hello team' }, true],
    ['a whitespace-only post', { body: '   ' }, false],
    ['a post over 4000 characters', { body: 'x'.repeat(4001) }, false],
    ['an extra field', { body: 'Hi', author: 'me' }, false],
  ])('team post accepts or rejects %s as expected', (_label, input, ok) => {
    expect(hackathonTeamPostSchema.safeParse(input).success).toBe(ok);
  });
});

describe('listHackathonTeams', () => {
  it('refuses non-employees before listing anything', async () => {
    queryOne.mockResolvedValueOnce(null);
    await expect(listHackathonTeams(USER, ORG)).rejects.toThrow('Active employee membership required');
    expect(query).not.toHaveBeenCalled();
  });

  it('lists open teams plus teams the caller is in, scoped to the workspace or global teams outside sandboxes', async () => {
    queryOne.mockResolvedValueOnce({ id: 'm-1' });
    query.mockResolvedValueOnce([]);
    await listHackathonTeams(USER, ORG);
    const [sql, params] = sqlCalls()[0];
    expect(sql).toMatch(/WHERE t\.org_id = \$2 OR \(t\.org_id IS NULL AND workspace\.is_sandbox = false\)/);
    expect(sql).toMatch(/HAVING t\.status = 'open' OR bool_or\(tm\.user_id = \$1\)/);
    expect(params).toEqual([USER, ORG]);
  });
});

describe('createHackathonTeam', () => {
  it('refuses a non-employee and creates nothing', async () => {
    query.mockResolvedValueOnce([]);
    await expect(createHackathonTeam(USER, ORG, { name: 'Credit Crew', description: 'We build credit risk tools.' }, 'r')).rejects.toThrow(
      'Active employee membership required',
    );
    expect(sqlCalls()).toHaveLength(1);
  });

  it('creates an open team, makes the creator its lead, and audits the creation in one transaction', async () => {
    query
      .mockResolvedValueOnce([{ id: 'm-1' }])
      .mockResolvedValueOnce([{ id: TEAM }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await expect(createHackathonTeam(USER, ORG, { name: 'Credit Crew', description: 'We build credit risk tools.' }, 'req-t')).resolves.toEqual({
      id: TEAM, name: 'Credit Crew', description: 'We build credit risk tools.', status: 'open', member_count: 1, is_member: true, my_role: 'lead',
    });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(sqlCalls()[1][0]).toMatch(/CASE WHEN \(SELECT is_sandbox FROM organizations WHERE id = \$1\) THEN \$1 ELSE NULL END/);
    expect(sqlCalls()[1][1]).toEqual([ORG, 'Credit Crew', 'We build credit risk tools.', USER]);
    expect(sqlCalls()[2][1]).toEqual([TEAM, USER]);
    expect(sqlCalls()[2][0]).toMatch(/VALUES \(\$1, \$2, 'lead'\)/);
    expect(sqlCalls()[3][1]).toEqual([USER, TEAM, ORG, 'req-t']);
  });
});

describe('joinHackathonTeam and leaveHackathonTeam', () => {
  it('refuses to join a team that is closed, missing, or in another scope', async () => {
    query.mockResolvedValueOnce([{ id: 'm-1' }]).mockResolvedValueOnce([]);
    await expect(joinHackathonTeam(TEAM, USER, ORG, 'r')).rejects.toThrow('Open team not found');
    expect(sqlCalls()[1][0]).toMatch(/AND status = 'open' FOR UPDATE/);
    expect(sqlCalls()).toHaveLength(2);
  });

  it('adds the caller as a member, touches the team and audits the join', async () => {
    query
      .mockResolvedValueOnce([{ id: 'm-1' }])
      .mockResolvedValueOnce([{ id: TEAM }])
      .mockResolvedValueOnce([{ user_id: USER }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    await expect(joinHackathonTeam(TEAM, USER, ORG, 'req-j')).resolves.toEqual({ id: TEAM, is_member: true });
    expect(sqlCalls()[2][0]).toMatch(/VALUES \(\$1, \$2, 'member'\) ON CONFLICT \(team_id, user_id\) DO NOTHING/);
    expect(sqlCalls()[4][1]).toEqual([USER, TEAM, ORG, 'req-j']);
  });

  it('is idempotent: joining a team the caller already belongs to writes no audit or touch', async () => {
    query
      .mockResolvedValueOnce([{ id: 'm-1' }])
      .mockResolvedValueOnce([{ id: TEAM }])
      .mockResolvedValueOnce([]);
    await expect(joinHackathonTeam(TEAM, USER, ORG, 'r')).resolves.toEqual({ id: TEAM, is_member: true });
    expect(sqlCalls()).toHaveLength(3);
  });

  it('refuses to leave a team the caller is not in', async () => {
    query.mockResolvedValueOnce([{ id: 'm-1' }]).mockResolvedValueOnce([]);
    await expect(leaveHackathonTeam(TEAM, USER, ORG, 'r')).rejects.toThrow('Team membership not found');
    expect(sqlCalls().some(([sql]) => sql.includes('DELETE FROM employee_hackathon_team_members'))).toBe(false);
  });

  it('hands the lead role to the longest-standing other member when the lead leaves a team with others', async () => {
    query
      .mockResolvedValueOnce([{ id: 'm-1' }])
      .mockResolvedValueOnce([{ role: 'lead' }])
      .mockResolvedValueOnce([{ count: 1 }])
      .mockResolvedValueOnce([{ user_id: OTHER }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    await expect(leaveHackathonTeam(TEAM, USER, ORG, 'req-l')).resolves.toEqual({ id: TEAM, is_member: false });
    const promote = sqlCalls()[4];
    expect(promote[0]).toMatch(/UPDATE employee_hackathon_team_members SET role = 'lead'/);
    expect(promote[1]).toEqual([TEAM, OTHER]);
    expect(sqlCalls().some(([sql]) => sql.includes("SET status = 'closed'"))).toBe(false);
  });

  it('closes the team when its last lead leaves and nobody else is a member', async () => {
    query
      .mockResolvedValueOnce([{ id: 'm-1' }])
      .mockResolvedValueOnce([{ role: 'lead' }])
      .mockResolvedValueOnce([{ count: 1 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    await leaveHackathonTeam(TEAM, USER, ORG, 'r');
    expect(sqlCalls().some(([sql]) => sql.includes("UPDATE employee_hackathon_teams SET status = 'closed'"))).toBe(true);
  });

  it('removes a plain member without changing leadership', async () => {
    query
      .mockResolvedValueOnce([{ id: 'm-1' }])
      .mockResolvedValueOnce([{ role: 'member' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    await leaveHackathonTeam(TEAM, USER, ORG, 'r');
    expect(sqlCalls().some(([sql]) => sql.includes("SET role = 'lead'"))).toBe(false);
    expect(sqlCalls().some(([sql]) => sql.includes('DELETE FROM employee_hackathon_team_members'))).toBe(true);
  });
});

describe('team posts', () => {
  it('refuses to list posts for a non-member of the team', async () => {
    queryOne.mockResolvedValueOnce({ id: 'm-1' }).mockResolvedValueOnce(null);
    await expect(listHackathonTeamPosts(TEAM, USER, ORG)).rejects.toThrow('Team membership required');
    expect(query).not.toHaveBeenCalled();
  });

  it('lists posts for a team member, newest first, capped at 100', async () => {
    queryOne.mockResolvedValueOnce({ id: 'm-1' }).mockResolvedValueOnce({ id: TEAM });
    query.mockResolvedValueOnce([]);
    await listHackathonTeamPosts(TEAM, USER, ORG);
    const [sql, params] = sqlCalls()[0];
    expect(sql).toMatch(/ORDER BY p\.created_at DESC, p\.id DESC LIMIT 100/);
    expect(params).toEqual([TEAM, ORG]);
  });

  it('refuses a post from someone who is not on the team and inserts nothing', async () => {
    query.mockResolvedValueOnce([{ id: 'm-1' }]).mockResolvedValueOnce([]);
    await expect(createHackathonTeamPost(TEAM, USER, ORG, { body: 'Hi' }, 'r')).rejects.toThrow('Team membership required');
    expect(sqlCalls().some(([sql]) => sql.includes('INSERT INTO employee_hackathon_team_posts'))).toBe(false);
  });

  it('stores the post for a team member, audits it and returns the author as "You"', async () => {
    query
      .mockResolvedValueOnce([{ id: 'm-1' }])
      .mockResolvedValueOnce([{ team_id: TEAM }])
      .mockResolvedValueOnce([{ id: 'post-1', created_at: new Date('2026-10-31T00:00:00Z') }])
      .mockResolvedValueOnce([]);
    await expect(createHackathonTeamPost(TEAM, USER, ORG, { body: 'Kickoff at 10' }, 'req-post')).resolves.toMatchObject({
      id: 'post-1', body: 'Kickoff at 10', author: 'You',
    });
    expect(sqlCalls()[1][0]).toMatch(/FOR SHARE OF tm, t/);
    expect(sqlCalls()[2][1]).toEqual([TEAM, USER, 'Kickoff at 10']);
    expect(sqlCalls()[3][1]).toEqual([USER, 'post-1', ORG, 'req-post']);
  });
});
