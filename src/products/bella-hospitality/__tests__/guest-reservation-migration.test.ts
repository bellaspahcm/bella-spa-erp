import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'fs';
import path from 'path';

const MIGRATION_PATH = path.resolve(
  __dirname,
  '../../../../supabase/migrations/20261008030000_create_hospitality_guest_reservation_foundation.sql'
);

const migrationSql = readFileSync(MIGRATION_PATH, 'utf8');

describe('Hospitality Phase 2 migration shape', () => {
  it('creates only the approved Guest + Reservation tables', () => {
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS public.hospitality_guests');
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS public.hospitality_reservations');
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS public.hospitality_reservation_rooms');

    expect(migrationSql).not.toContain('hospitality_stays');
    expect(migrationSql).not.toContain('hospitality_folios');
    expect(migrationSql).not.toContain('hospitality_payments');
    expect(migrationSql).not.toContain('hospitality_housekeeping');
    expect(migrationSql).not.toContain('hospitality_travel');
    expect(migrationSql).not.toContain('hospitality_tours');
  });

  it('reuses Party identity and the sealed Phase 1 property room foundation', () => {
    expect(migrationSql).toContain('party_id UUID NOT NULL REFERENCES public.party_parties(id)');
    expect(migrationSql).toContain('REFERENCES public.hospitality_properties(tenant_id, id)');
    expect(migrationSql).toContain('REFERENCES public.hospitality_guests(tenant_id, id)');
    expect(migrationSql).toContain('REFERENCES public.hospitality_room_types(tenant_id, property_id, id)');
    expect(migrationSql).toContain('REFERENCES public.hospitality_rooms(id)');
  });

  it('enforces tenant ownership, local reservation semantics, and RLS', () => {
    const tables = [
      'hospitality_guests',
      'hospitality_reservations',
      'hospitality_reservation_rooms',
    ];

    for (const table of tables) {
      expect(migrationSql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
      expect(migrationSql).toContain(`REVOKE ALL ON public.${table} FROM anon`);
      expect(migrationSql).toContain(`GRANT SELECT, INSERT, UPDATE, DELETE ON public.${table} TO authenticated, service_role`);
    }

    expect(migrationSql).toContain('hospitality_validate_guest_party_tenant');
    expect(migrationSql).toContain('hospitality_validate_reservation_room');
    expect(migrationSql).toContain('HOSPITALITY_OCCUPANCY_EXCEEDS_ROOM_TYPE');
    expect(migrationSql).toContain('HOSPITALITY_ROOM_ALREADY_RESERVED');
    expect(migrationSql).toContain('public.get_auth_tenant_id()');
    expect(migrationSql).toContain("current_setting('app.current_tenant_id', TRUE)");
  });
});
