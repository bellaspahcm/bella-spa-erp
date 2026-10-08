import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'fs';
import path from 'path';

const MIGRATION_PATH = path.resolve(
  __dirname,
  '../../../../supabase/migrations/20261008020000_create_hospitality_property_room_foundation.sql'
);

const migrationSql = readFileSync(MIGRATION_PATH, 'utf8');

describe('Hospitality Phase 1 migration shape', () => {
  it('creates only the approved Hotel physical foundation tables', () => {
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS public.hospitality_properties');
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS public.hospitality_buildings');
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS public.hospitality_floors');
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS public.hospitality_room_types');
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS public.hospitality_rooms');

    expect(migrationSql).not.toContain('hospitality_reservations');
    expect(migrationSql).not.toContain('hospitality_stays');
    expect(migrationSql).not.toContain('hospitality_folios');
    expect(migrationSql).not.toContain('hospitality_guests');
    expect(migrationSql).not.toContain('hospitality_travel');
  });

  it('enforces tenant ownership and hierarchy consistency', () => {
    expect(migrationSql).toContain('tenant_id UUID NOT NULL REFERENCES public.tenants(id)');
    expect(migrationSql).toContain('fk_hospitality_buildings_property_tenant');
    expect(migrationSql).toContain('fk_hospitality_floors_building_tenant');
    expect(migrationSql).toContain('fk_hospitality_rooms_floor_tenant');
    expect(migrationSql).toContain('fk_hospitality_rooms_room_type_tenant');
    expect(migrationSql).toContain('uq_hospitality_rooms_property_room_number');
  });

  it('enables RLS and keeps anon access revoked on every Phase 1 table', () => {
    const tables = [
      'hospitality_properties',
      'hospitality_buildings',
      'hospitality_floors',
      'hospitality_room_types',
      'hospitality_rooms',
    ];

    for (const table of tables) {
      expect(migrationSql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
      expect(migrationSql).toContain(`REVOKE ALL ON public.${table} FROM anon`);
      expect(migrationSql).toContain(`GRANT SELECT, INSERT, UPDATE, DELETE ON public.${table} TO authenticated, service_role`);
    }

    expect(migrationSql).toContain('public.get_auth_tenant_id()');
    expect(migrationSql).toContain("current_setting('app.current_tenant_id', TRUE)");
  });
});
