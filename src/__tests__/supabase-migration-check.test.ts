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

  it('detects local migrations missing from the remote database', () => {
    const state = analyzeMigrationState(
      ['20260606100000', '20260606103000', '20260606113000'],
      ['20260606100000']
    );

    expect(state.isSynced).toBe(false);
    expect(state.latestLocal).toBe('20260606113000');
    expect(state.latestRemote).toBe('20260606100000');
    expect(state.pendingLocal).toEqual(['20260606103000', '20260606113000']);
    expect(state.remoteOnly).toEqual([]);
  });

  it('detects remote-only migration drift', () => {
    const state = analyzeMigrationState(
      ['20260606100000'],
      ['20260606100000', '20260606104500']
    );

    expect(state.isSynced).toBe(false);
    expect(state.pendingLocal).toEqual([]);
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
