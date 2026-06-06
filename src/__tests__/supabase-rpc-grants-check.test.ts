const {
  findMissingCriticalGrants,
  formatGrantSignature,
  normalizeArgs,
  parseGrantExecuteStatements,
} = require('../../scripts/check-supabase-rpc-grants.cjs');

describe('Supabase RPC grants check script', () => {
  it('normalizes grant signatures', () => {
    expect(normalizeArgs(['uuid', ' date ', 'jsonb'])).toBe('UUID, DATE, JSONB');
    expect(normalizeArgs(' uuid,\n text,\tjsonb ')).toBe('UUID, TEXT, JSONB');
  });

  it('parses multiline GRANT EXECUTE statements', () => {
    const grants = parseGrantExecuteStatements(`
      GRANT EXECUTE ON FUNCTION public.record_remaining_payment_atomic(
        UUID, NUMERIC, TEXT, DATE, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, JSONB, JSONB
      ) TO authenticated, service_role;

      GRANT EXECUTE ON FUNCTION public.claim_outbox_batch(INTEGER) TO service_role;
    `);

    expect(grants).toEqual([
      {
        name: 'record_remaining_payment_atomic',
        args: 'UUID, NUMERIC, TEXT, DATE, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, JSONB, JSONB',
        roles: ['authenticated', 'service_role'],
      },
      {
        name: 'claim_outbox_batch',
        args: 'INTEGER',
        roles: ['service_role'],
      },
    ]);
  });

  it('detects a missing critical grant', () => {
    const missing = findMissingCriticalGrants(
      [{ name: 'get_trial_balance', args: ['UUID', 'DATE'], roles: ['authenticated', 'service_role'] }],
      []
    );

    expect(missing).toEqual([
      {
        name: 'get_trial_balance',
        args: ['UUID', 'DATE'],
        roles: ['authenticated', 'service_role'],
        missingRoles: ['authenticated', 'service_role'],
        reason: 'missing grant',
      },
    ]);
  });

  it('detects missing required roles on an existing grant', () => {
    const missing = findMissingCriticalGrants(
      [{ name: 'get_trial_balance', args: ['UUID', 'DATE'], roles: ['authenticated', 'service_role'] }],
      [{ name: 'get_trial_balance', args: 'UUID, DATE', roles: ['authenticated'] }]
    );

    expect(missing).toEqual([
      {
        name: 'get_trial_balance',
        args: ['UUID', 'DATE'],
        roles: ['authenticated', 'service_role'],
        missingRoles: ['service_role'],
        reason: 'missing required role',
      },
    ]);
  });

  it('accumulates roles across repeated grants for the same signature', () => {
    const missing = findMissingCriticalGrants(
      [{ name: 'get_trial_balance', args: ['UUID', 'DATE'], roles: ['authenticated', 'service_role'] }],
      [
        { name: 'get_trial_balance', args: 'UUID, DATE', roles: ['authenticated'] },
        { name: 'get_trial_balance', args: 'UUID, DATE', roles: ['service_role'] },
      ]
    );

    expect(missing).toEqual([]);
  });

  it('passes when every required role is granted', () => {
    const missing = findMissingCriticalGrants(
      [{ name: 'claim_outbox_batch', args: ['INTEGER'], roles: ['service_role'] }],
      [{ name: 'claim_outbox_batch', args: 'INTEGER', roles: ['service_role'] }]
    );

    expect(missing).toEqual([]);
  });

  it('formats signatures for diagnostics', () => {
    expect(formatGrantSignature({ name: 'claim_outbox_batch', args: ['INTEGER'] })).toBe(
      'public.claim_outbox_batch(INTEGER)'
    );
  });
});
