import { readFileSync } from 'fs';
import { join } from 'path';

const migrationSql = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260607023000_harden_accounting_outbox_idempotency.sql'),
  'utf8'
);

describe('accounting outbox idempotency migration', () => {
  it('scopes outbox idempotency by tenant, event, reference type, and reference id', () => {
    expect(migrationSql).toContain(
      'ADD CONSTRAINT outbox_idempotency UNIQUE (tenant_id, event_type, reference_type, reference_id)'
    );
    expect(migrationSql).toContain(
      'ON CONFLICT (tenant_id, event_type, reference_type, reference_id) DO NOTHING'
    );
  });

  it('returns the existing outbox id when a duplicate business event is enqueued', () => {
    expect(migrationSql).toContain('IF v_id IS NULL THEN');
    expect(migrationSql).toContain('FROM public.accounting_outbox');
    expect(migrationSql).toContain('AND reference_type = p_reference_type');
    expect(migrationSql).toContain('RETURN v_id');
  });

  it('routes remaining payment accounting through the central enqueue RPC', () => {
    expect(migrationSql).toContain('v_outbox_id := public.enqueue_accounting_event');
    expect(migrationSql).toContain('IF v_outbox_id IS NULL THEN');
    expect(migrationSql).not.toContain('ON CONFLICT (event_type, reference_id) DO NOTHING');
  });

  it('keeps the raw enqueue RPC restricted to service role callers', () => {
    expect(migrationSql).toContain('FROM PUBLIC, anon, authenticated');
    expect(migrationSql).toContain('GRANT EXECUTE ON FUNCTION public.enqueue_accounting_event');
    expect(migrationSql).toContain(') TO service_role');
  });
});
