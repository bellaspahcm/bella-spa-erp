import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'fs';
import path from 'path';

const MIGRATION_PATH = path.resolve(
  __dirname,
  '../../../../supabase/migrations/20261008040000_create_hospitality_front_office_stay_foundation.sql'
);

const migrationSql = readFileSync(MIGRATION_PATH, 'utf8');

describe('Hospitality Phase 3 migration shape', () => {
  it('creates only the approved Front Office stay tables', () => {
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS public.hospitality_stays');
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS public.hospitality_room_occupancies');

    expect(migrationSql).not.toContain('hospitality_folios');
    expect(migrationSql).not.toContain('hospitality_folio_items');
    expect(migrationSql).not.toContain('hospitality_payments');
    expect(migrationSql).not.toContain('hospitality_housekeeping');
    expect(migrationSql).not.toContain('hospitality_maintenance');
    expect(migrationSql).not.toContain('hospitality_fnb');
    expect(migrationSql).not.toContain('hospitality_travel');
    expect(migrationSql).not.toContain('hospitality_tours');
  });

  it('reuses sealed Reservation and Reserved Room contracts without altering them', () => {
    expect(migrationSql).toContain('REFERENCES public.hospitality_reservations(tenant_id, property_id, id)');
    expect(migrationSql).toContain('REFERENCES public.hospitality_guests(tenant_id, id)');
    expect(migrationSql).toContain('REFERENCES public.hospitality_reservation_rooms(id)');
    expect(migrationSql).toContain('REFERENCES public.hospitality_rooms(id)');
    expect(migrationSql).not.toMatch(/ALTER TABLE public\.hospitality_reservations/);
    expect(migrationSql).not.toMatch(/ALTER TABLE public\.hospitality_reservation_rooms/);
  });

  it('enforces tenant ownership, active occupancy, and RLS', () => {
    const tables = [
      'hospitality_stays',
      'hospitality_room_occupancies',
    ];

    for (const table of tables) {
      expect(migrationSql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
      expect(migrationSql).toContain(`REVOKE ALL ON public.${table} FROM anon`);
      expect(migrationSql).toContain(`GRANT SELECT, INSERT, UPDATE, DELETE ON public.${table} TO authenticated, service_role`);
    }

    expect(migrationSql).toContain('hospitality_validate_stay_check_in');
    expect(migrationSql).toContain('hospitality_validate_room_occupancy');
    expect(migrationSql).toContain('uq_hospitality_room_occupancies_active_room');
    expect(migrationSql).toContain('HOSPITALITY_OCCUPANCY_REQUIRES_ACTIVE_STAY');
    expect(migrationSql).toContain('HOSPITALITY_OCCUPANCY_RESERVED_ROOM_MISMATCH');
    expect(migrationSql).toContain('public.get_auth_tenant_id()');
    expect(migrationSql).toContain("current_setting('app.current_tenant_id', TRUE)");
  });
});
