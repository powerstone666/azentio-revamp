import { createSandboxWorkspace, WorkspaceError } from '@/app/api/(services)/workspaces/service';
import { transaction } from '@/app/api/(db)/client';

jest.mock('@/app/api/(db)/client', () => ({ transaction: jest.fn(), query: jest.fn(), queryOne: jest.fn() }));

type Call = { sql: string; params: unknown[] };

function run(responses: { ok?: boolean; owned?: number; orgId?: string | null }) {
  const calls: Call[] = [];
  (transaction as jest.Mock).mockImplementation(async (fn: (tx: unknown) => unknown) => fn(async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    if (sql.includes('SELECT EXISTS')) return [{ ok: responses.ok ?? true }];
    if (sql.includes('count(*)')) return [{ n: responses.owned ?? 0 }];
    if (sql.includes('INSERT INTO organizations')) return responses.orgId === null ? [] : [{ id: responses.orgId ?? 'org-new' }];
    if (sql.includes('INSERT INTO memberships')) return [{ id: 'mem-new' }];
    return [];
  }));
  return calls;
}

const input = { actorId: 'u1', sourceOrgId: 'org-src', name: '  Northwind   pilot ', requestId: 'r1' };

describe('createSandboxWorkspace', () => {
  it('creates a sandbox client org, makes the actor client_admin, copies offerings and audits', async () => {
    const calls = run({});
    await expect(createSandboxWorkspace(input)).resolves.toEqual({ org_id: 'org-new', membership_id: 'mem-new', name: 'Northwind pilot' });
    const org = calls.find((c) => c.sql.includes('INSERT INTO organizations'))!;
    expect(org.sql).toContain("'client', 'active', true");
    expect(org.params).toEqual(['Northwind pilot']);
    expect(calls.find((c) => c.sql.includes('INSERT INTO memberships'))!.sql).toContain("'client_admin'");
    expect(calls.find((c) => c.sql.includes('INSERT INTO entitlements'))!.params).toEqual(['org-new', 'org-src', 'u1']);
    expect(calls.find((c) => c.sql.includes('INSERT INTO audit_log'))!.sql).toContain('workspace.create_sandbox');
  });

  it('only checks sandbox client_admin membership of the source org (never trusts the client)', async () => {
    const calls = run({});
    await createSandboxWorkspace(input);
    const check = calls[0];
    expect(check.sql).toContain("m.role = 'client_admin'");
    expect(check.sql).toContain('o.is_sandbox = true');
    expect(check.params).toEqual(['u1', 'org-src']);
  });

  it('rejects a non-admin or non-sandbox source with 403 and writes nothing', async () => {
    const calls = run({ ok: false });
    await expect(createSandboxWorkspace(input)).rejects.toMatchObject({ status: 403 });
    expect(calls.some((c) => c.sql.includes('INSERT'))).toBe(false);
  });

  it('caps the number of administered demo workspaces', async () => {
    run({ owned: 5 });
    await expect(createSandboxWorkspace(input)).rejects.toMatchObject({ status: 409 });
  });

  it('reports a duplicate name as 409', async () => {
    run({ orgId: null });
    await expect(createSandboxWorkspace(input)).rejects.toMatchObject({ status: 409 });
  });

  it.each(['', 'ab', 'x'.repeat(81)])('rejects invalid name %j before touching the database', async (name) => {
    (transaction as jest.Mock).mockClear();
    await expect(createSandboxWorkspace({ ...input, name })).rejects.toBeInstanceOf(WorkspaceError);
    expect(transaction).not.toHaveBeenCalled();
  });
});
