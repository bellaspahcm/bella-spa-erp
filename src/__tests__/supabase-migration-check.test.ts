const {
  analyzeMigrationState,
  parseSupabaseMigrationList,
} = require('../../scripts/check-supabase-migrations.cjs');

describe('Supabase migration check script', () => {
  it('parses Supabase CLI migration list output', () => {
    const output = `
      Local          | Remote         | Time (UTC)
    ----------------|----------------|---------------------
      20260606100000 | 20260606100000 | 2026-06-06 10:00:00
      20260606103000 |                | 2026-06-06 10:30:00
                     | 20260606104500 | 2026-06-06 10:45:00
    `;

    expect(parseSupabaseMigrationList(output)).toEqual([
      { local: '20260606100000', remote: '20260606100000' },
      { local: '20260606103000', remote: null },
      { local: null, remote: '20260606104500' },
    ]);
  });

  it('parses current Supabase CLI JSON output with status prelude', () => {
    const output = `Connecting to remote database...
{"migrations":[{"local":"20260912100000","remote":"","time":"2026-09-12 10:00:00"},{"local":"20261002040000","remote":"20261002040000","time":"2026-10-02 04:00:00"}],"message":"Migrations listed"}
A new version of Supabase CLI is available.`;

    expect(parseSupabaseMigrationList(output)).toEqual([
      { local: '20260912100000', remote: null },
      { local: '20261002040000', remote: '20261002040000' },
    ]);
  });

  it('parses table output with backtick-wrapped migration ids', () => {
    const output = `
      Local            | Remote           | Time (UTC)
    ------------------|------------------|---------------------
      \`20260912100000\` | \` \`              | \`2026-09-12 10:00:00\`
      \`20261002040000\` | \`20261002040000\` | \`2026-10-02 04:00:00\`
    `;

    expect(parseSupabaseMigrationList(output)).toEqual([
      { local: '20260912100000', remote: null },
      { local: '20261002040000', remote: '20261002040000' },
    ]);
  });

  it('detects local migrations missing from the remote database', () => {
    const state = analyzeMigrationState(
      ['20260606100000', '20260606103000', '20260606113000'],
      ['20260606100000']
    );

    expect(state.isSynced).toBe(false);
    expect(state.latestLocal).toBe('20260606113000');
    expect(state.latestRemote).toBe('20260606100000');
    expect(state.pendingLocal).toEqual(['20260606103000', '20260606113000']);
    expect(state.newPendingLocal).toEqual(['20260606103000', '20260606113000']);
    expect(state.grandfatheredPendingLocal).toEqual([]);
    expect(state.remoteOnly).toEqual([]);
  });

  it('grandfathers local migration drift already present at the baseline ref', () => {
    const state = analyzeMigrationState(
      ['20260606100000', '20260606103000'],
      ['20260606100000'],
      ['20260606100000', '20260606103000']
    );

    expect(state.isSynced).toBe(true);
    expect(state.pendingLocal).toEqual(['20260606103000']);
    expect(state.newPendingLocal).toEqual([]);
    expect(state.grandfatheredPendingLocal).toEqual(['20260606103000']);
    expect(state.remoteOnly).toEqual([]);
  });

  it('still detects new local migration drift beyond the baseline ref', () => {
    const state = analyzeMigrationState(
      ['20260606100000', '20260606103000', '20260606113000'],
      ['20260606100000'],
      ['20260606100000', '20260606103000']
    );

    expect(state.isSynced).toBe(false);
    expect(state.pendingLocal).toEqual(['20260606103000', '20260606113000']);
    expect(state.grandfatheredPendingLocal).toEqual(['20260606103000']);
    expect(state.newPendingLocal).toEqual(['20260606113000']);
    expect(state.remoteOnly).toEqual([]);
  });

  it('detects remote-only migration drift', () => {
    const state = analyzeMigrationState(
      ['20260606100000'],
      ['20260606100000', '20260606104500']
    );

    expect(state.isSynced).toBe(false);
    expect(state.pendingLocal).toEqual([]);
    expect(state.newPendingLocal).toEqual([]);
    expect(state.grandfatheredPendingLocal).toEqual([]);
    expect(state.remoteOnly).toEqual(['20260606104500']);
  });

  it('passes when local and remote migrations match exactly', () => {
    const state = analyzeMigrationState(
      ['20260606100000', '20260606113000'],
      ['20260606100000', '20260606113000']
    );

    expect(state.isSynced).toBe(true);
    expect(state.pendingLocal).toEqual([]);
    expect(state.remoteOnly).toEqual([]);
  });
});
