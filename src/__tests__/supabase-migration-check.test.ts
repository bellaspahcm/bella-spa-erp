/* eslint-disable @typescript-eslint/no-require-imports */
const {
  analyzeMigrationState,
  findDuplicateMigrationVersions,
  findInvalidMigrationFilenames,
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

  it('parses Supabase CLI JSON migration list output', () => {
    const output = `
      Update available 2.54.11 -> 2.55.3
      {
        "migrations": [
          { "local": "20260606100000", "remote": "20260606100000", "time": "2026-06-06 10:00:00" },
          { "local": "20260606103000", "remote": null, "time": "2026-06-06 10:30:00" },
          { "local": null, "remote": "20260606104500", "time": "2026-06-06 10:45:00" }
        ]
      }
    `;

    expect(parseSupabaseMigrationList(output)).toEqual([
      { local: '20260606100000', remote: '20260606100000' },
      { local: '20260606103000', remote: null },
      { local: null, remote: '20260606104500' },
    ]);
  });

  it('detects invalid local migration filenames', () => {
    expect(
      findInvalidMigrationFilenames([
        '20260606100000_valid.sql',
        '20260606_missing_time.sql',
        'notes.md',
      ])
    ).toEqual(['20260606_missing_time.sql', 'notes.md']);
  });
  it('detects duplicate local migration versions', () => {
    expect(
      findDuplicateMigrationVersions([
        '20260606100000',
        '20260606103000',
        '20260606103000',
        '20260606104500',
      ])
    ).toEqual(['20260606103000']);
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
