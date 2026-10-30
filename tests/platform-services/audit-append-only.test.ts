/**
 * The audit folder (app/api/(services)/audit) has no service module yet. Append-only behaviour is enforced by
 * the database (triggers in the schema) and by every write site in the services using INSERT only.
 * These tests check both statically, so a future UPDATE/DELETE/TRUNCATE on audit_log fails fast.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.join(process.cwd(), 'app');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

function sourcesUnder(...segments: string[]) {
  return walk(path.join(ROOT, ...segments))
    .filter((file) => /\.(ts|tsx)$/.test(file))
    .map((file) => ({ file, source: readFileSync(file, 'utf8') }));
}

describe('audit_log is append-only at the database layer', () => {
  const schema = readFileSync(path.join(ROOT, 'api/(db)/schema/initial.sql'), 'utf8');

  it('rejects UPDATE and DELETE on every row with a trigger', () => {
    expect(schema).toMatch(/CREATE TRIGGER audit_log_no_row_mutation\s+BEFORE UPDATE OR DELETE ON audit_log\s+FOR EACH ROW EXECUTE FUNCTION reject_audit_log_mutation\(\)/);
  });

  it('rejects TRUNCATE with a statement-level trigger', () => {
    expect(schema).toMatch(/CREATE TRIGGER audit_log_no_truncate\s+BEFORE TRUNCATE ON audit_log\s+FOR EACH STATEMENT EXECUTE FUNCTION reject_audit_log_mutation\(\)/);
  });

  it('raises an exception from the shared guard function', () => {
    expect(schema).toMatch(/RAISE EXCEPTION 'audit_log is append-only; % is not permitted', TG_OP;/);
  });

  it('enables row level security with no anon or authenticated access', () => {
    expect(schema).toMatch(/ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;/);
    expect(schema).toMatch(/CREATE POLICY "no_anon_access" ON audit_log FOR ALL TO anon USING \(false\);/);
    expect(schema).toMatch(/CREATE POLICY "no_authenticated_access" ON audit_log FOR ALL TO authenticated USING \(false\);/);
  });
});

describe('application code only appends to audit_log', () => {
  const files = [...sourcesUnder('api', '(services)'), ...sourcesUnder('api', 'v1')];

  it('finds at least one audit write, so the scan is actually looking at something', () => {
    const writes = files.filter(({ source }) => source.includes('INSERT INTO audit_log'));
    expect(writes.length).toBeGreaterThan(5);
  });

  it.each([
    ['UPDATE audit_log'],
    ['DELETE FROM audit_log'],
    ['TRUNCATE audit_log'],
    ['TRUNCATE TABLE audit_log'],
  ])('contains no %s statement', (statement) => {
    const offenders = files.filter(({ source }) => source.includes(statement)).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('only uses audit_log as an INSERT target or a read source (FROM)', () => {
    const offenders: string[] = [];
    for (const { file, source } of files) {
      for (const match of source.matchAll(/audit_log/g)) {
        const index = match.index ?? 0;
        const before = source.slice(Math.max(0, index - 5), index);
        if (before !== 'INTO ' && before !== 'FROM ') offenders.push(`${path.relative(process.cwd(), file)}@${index}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
