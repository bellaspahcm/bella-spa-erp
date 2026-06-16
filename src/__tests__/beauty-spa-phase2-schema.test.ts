import { readFileSync } from 'fs';
import path from 'path';

const migrationSql = readFileSync(
  path.join(
    process.cwd(),
    'supabase/migrations/20260608110000_create_beauty_spa_phase2_foundation.sql',
  ),
  'utf8',
);
const resourceSessionMigrationSql = readFileSync(
  path.join(
    process.cwd(),
    'supabase/migrations/20260611130000_add_session_booking_resource.sql',
  ),
  'utf8',
);
const resourceScheduleGuardSource = readFileSync(
  path.join(process.cwd(), 'src/core/services/order/booking-resource-schedule-guard.ts'),
  'utf8',
);
const createSessionActionSource = readFileSync(
  path.join(process.cwd(), 'src/core/services/order/create-session-log-action.ts'),
  'utf8',
);
const updateSessionActionSource = readFileSync(
  path.join(process.cwd(), 'src/modules/booking/actions/update-session-log-action.ts'),
  'utf8',
);
const rescheduleSessionActionSource = readFileSync(
  path.join(process.cwd(), 'src/modules/booking/actions/reschedule-session-action.ts'),
  'utf8',
);

describe('Beauty Spa phase 2 foundation schema', () => {
  it('extends packages instead of creating a parallel service table', () => {
    expect(migrationSql).toContain('ALTER TABLE public.packages');
    expect(migrationSql).toContain('ADD COLUMN IF NOT EXISTS module_key TEXT');
    expect(migrationSql).toContain("CHECK (module_key IN ('babycare', 'beauty_spa'))");
    expect(migrationSql).toContain("CHECK (service_kind IN ('single_service', 'treatment_package', 'retail_product', 'consultation'))");
    expect(migrationSql).not.toContain('CREATE TABLE IF NOT EXISTS public.beauty_services');
  });

  it('creates tenant-scoped schedulable resources with RLS and no anon access', () => {
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS public.booking_resources');
    expect(migrationSql).toContain("CHECK (resource_type IN ('bed', 'room', 'machine', 'chair', 'other'))");
    expect(migrationSql).toContain("CHECK (status IN ('available', 'in_use', 'maintenance', 'inactive'))");
    expect(migrationSql).toContain('ALTER TABLE public.booking_resources ENABLE ROW LEVEL SECURITY');
    expect(migrationSql).toContain('public.get_auth_tenant_id()');
    expect(migrationSql).toContain('REVOKE ALL ON TABLE public.booking_resources FROM anon');
    expect(migrationSql).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.booking_resources TO authenticated');
    expect(migrationSql).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.booking_resources TO service_role');
  });

  it('links resources to individual sessions instead of whole bookings', () => {
    expect(resourceSessionMigrationSql).toContain('ADD COLUMN IF NOT EXISTS booking_resource_id UUID NULL');
    expect(resourceSessionMigrationSql).toContain('FOREIGN KEY (booking_resource_id)');
    expect(resourceSessionMigrationSql).toContain('REFERENCES public.booking_resources(id)');
    expect(resourceSessionMigrationSql).toContain('ON DELETE SET NULL');
    expect(resourceSessionMigrationSql).toContain('idx_session_logs_booking_resource_schedule');
    expect(resourceSessionMigrationSql).toContain('tenant_id, booking_resource_id, assigned_date, assigned_time');
    expect(resourceSessionMigrationSql).toContain('WHERE booking_resource_id IS NOT NULL');
    expect(resourceSessionMigrationSql).not.toContain('ALTER TABLE public.bookings');
  });

  it('guards create, update, and reschedule flows against resource double-booking', () => {
    expect(resourceScheduleGuardSource).toContain(".eq('tenant_id', tenantId)");
    expect(resourceScheduleGuardSource).toContain(".eq('booking_resource_id', bookingResource.id)");
    expect(resourceScheduleGuardSource).toContain(".eq('assigned_date', assignedDate)");
    expect(resourceScheduleGuardSource).toContain(".in('assigned_time', getTimeConflictVariants(assignedTime))");
    expect(resourceScheduleGuardSource).toContain(".in('status', [...RESOURCE_ACTIVE_SESSION_STATUSES])");
    expect(resourceScheduleGuardSource).toContain(".neq('id', sessionId)");
    expect(createSessionActionSource).toContain('validateBookingResourceSchedule');
    expect(updateSessionActionSource).toContain('validateBookingResourceSchedule');
    expect(rescheduleSessionActionSource).toContain('validateBookingResourceSchedule');
  });
});
