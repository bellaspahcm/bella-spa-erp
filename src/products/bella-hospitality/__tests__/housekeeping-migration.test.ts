import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'fs';
import path from 'path';

const migrationPath = path.resolve(
  __dirname,
  '../../../../supabase/migrations/20261009010000_create_hospitality_housekeeping_foundation.sql'
);

describe('Bella Hospitality Phase 6 housekeeping migration', () => {
  const migrationSql = readFileSync(migrationPath, 'utf8');

  it('creates only product-owned housekeeping tables', () => {
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS public.hospitality_room_housekeeping_statuses');
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS public.hospitality_housekeeping_tasks');
    expect(migrationSql).not.toContain('CREATE TABLE IF NOT EXISTS public.hospitality_maintenance');
    expect(migrationSql).not.toContain('CREATE TABLE IF NOT EXISTS public.hospitality_fnb');
    expect(migrationSql).not.toContain('CREATE TABLE IF NOT EXISTS public.hospitality_travel');
    expect(migrationSql).not.toContain('resource_allocation');
    expect(migrationSql).not.toContain('global_resource_kernel');
  });

  it('keeps the canonical room status and housekeeping task vocabulary bounded', () => {
    expect(migrationSql).toContain("CHECK (status IN ('available', 'occupied', 'dirty', 'clean', 'inspected', 'out_of_order'))");
    expect(migrationSql).toContain("CHECK (task_type IN ('cleaning', 'inspection', 'maintenance_request', 'status_update'))");
    expect(migrationSql).toContain("CHECK (target_room_status IN ('available', 'occupied', 'dirty', 'clean', 'inspected', 'out_of_order'))");
  });

  it('enforces tenant RLS and avoids direct cross-domain tables', () => {
    expect(migrationSql).toContain('ALTER TABLE public.hospitality_room_housekeeping_statuses ENABLE ROW LEVEL SECURITY');
    expect(migrationSql).toContain('ALTER TABLE public.hospitality_housekeeping_tasks ENABLE ROW LEVEL SECURITY');
    expect(migrationSql).toContain('CREATE POLICY hospitality_room_housekeeping_statuses_tenant_isolation');
    expect(migrationSql).toContain('CREATE POLICY hospitality_housekeeping_tasks_tenant_isolation');
    expect(migrationSql).not.toMatch(/public\.finance_/i);
    expect(migrationSql).not.toMatch(/public\.hc_/i);
    expect(migrationSql).not.toMatch(/public\.logistics_/i);
  });
});
