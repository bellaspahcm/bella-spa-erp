import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'fs';
import path from 'path';

const migrationPath = path.resolve(
  __dirname,
  '../../../../supabase/migrations/20261009030000_create_hospitality_maintenance_foundation.sql'
);

describe('Bella Hospitality Phase 7 maintenance migration', () => {
  const migrationSql = readFileSync(migrationPath, 'utf8');

  it('creates only the product-owned maintenance request table', () => {
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS public.hospitality_maintenance_requests');
    expect(migrationSql).not.toContain('CREATE TABLE IF NOT EXISTS public.hospitality_fnb');
    expect(migrationSql).not.toContain('CREATE TABLE IF NOT EXISTS public.hospitality_travel');
    expect(migrationSql).not.toContain('CREATE TABLE IF NOT EXISTS public.hospitality_tours');
    expect(migrationSql).not.toContain('resource_allocation');
    expect(migrationSql).not.toContain('global_resource_kernel');
  });

  it('keeps maintenance lifecycle vocabulary bounded', () => {
    expect(migrationSql).toContain("CHECK (issue_type IN ('repair', 'safety', 'utilities', 'amenity', 'inspection', 'other'))");
    expect(migrationSql).toContain("CHECK (priority IN ('low', 'normal', 'high', 'urgent'))");
    expect(migrationSql).toContain("CHECK (status IN ('reported', 'assigned', 'in_progress', 'completed'))");
  });

  it('coordinates with Housekeeping without reopening Housekeeping runtime', () => {
    expect(migrationSql).toContain('source_housekeeping_task_id UUID REFERENCES public.hospitality_housekeeping_tasks(id)');
    expect(migrationSql).toContain("AND task_type = 'maintenance_request'");
    expect(migrationSql).not.toContain('ALTER TABLE public.hospitality_housekeeping_tasks');
    expect(migrationSql).not.toContain('ALTER TABLE public.hospitality_room_housekeeping_statuses');
  });

  it('enforces tenant RLS and avoids direct cross-domain tables', () => {
    expect(migrationSql).toContain('ALTER TABLE public.hospitality_maintenance_requests ENABLE ROW LEVEL SECURITY');
    expect(migrationSql).toContain('CREATE POLICY hospitality_maintenance_requests_tenant_isolation');
    expect(migrationSql).not.toMatch(/public\.finance_/i);
    expect(migrationSql).not.toMatch(/public\.hc_/i);
    expect(migrationSql).not.toMatch(/public\.logistics_/i);
  });
});
