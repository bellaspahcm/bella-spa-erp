import { validateBookingResourceSchedule } from '@/core/services/order/booking-resource-schedule-guard';

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

function makeQueryBuilder(result: QueryResult) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const builder: any = {
    calls,
    select: jest.fn((...args: unknown[]) => {
      calls.push({ method: 'select', args });
      return builder;
    }),
    eq: jest.fn((...args: unknown[]) => {
      calls.push({ method: 'eq', args });
      return builder;
    }),
    in: jest.fn((...args: unknown[]) => {
      calls.push({ method: 'in', args });
      return builder;
    }),
    limit: jest.fn((...args: unknown[]) => {
      calls.push({ method: 'limit', args });
      return builder;
    }),
    neq: jest.fn((...args: unknown[]) => {
      calls.push({ method: 'neq', args });
      return builder;
    }),
    single: jest.fn(() => Promise.resolve(result)),
    then: (resolve: (value: QueryResult) => unknown, reject?: (reason: unknown) => unknown) => (
      Promise.resolve(result).then(resolve, reject)
    ),
  };

  return builder;
}

function makeSupabase(resourceResult: QueryResult, conflictResult: QueryResult) {
  const resourceQuery = makeQueryBuilder(resourceResult);
  const conflictQuery = makeQueryBuilder(conflictResult);
  const supabase = {
    from: jest.fn((table: string) => {
      if (table === 'booking_resources') return resourceQuery;
      if (table === 'session_logs') return conflictQuery;
      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  return { supabase, resourceQuery, conflictQuery };
}

describe('validateBookingResourceSchedule', () => {
  it('skips validation when no resource is assigned', async () => {
    const supabase = { from: jest.fn() };

    const result = await validateBookingResourceSchedule({
      supabase: supabase as never,
      tenantId: 'tenant-a',
      assignedDate: '2026-06-11',
      assignedTime: '10:00:00',
      status: 'scheduled',
    });

    expect(result).toEqual({ success: true });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('blocks unavailable resources before checking conflicts', async () => {
    const { supabase } = makeSupabase(
      {
        data: {
          id: 'resource-1',
          name: 'Phong facial 01',
          resource_type: 'room',
          status: 'maintenance',
          tenant_id: 'tenant-a',
        },
        error: null,
      },
      { data: [], error: null },
    );

    const result = await validateBookingResourceSchedule({
      supabase: supabase as never,
      tenantId: 'tenant-a',
      bookingResourceId: 'resource-1',
      assignedDate: '2026-06-11',
      assignedTime: '10:00:00',
      status: 'scheduled',
    });

    expect(result).toEqual({ error: 'Tai nguyen Phong facial 01 hien khong kha dung de dat lich.' });
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it('blocks duplicate active sessions for the same tenant, resource, date, and time', async () => {
    const { supabase, conflictQuery } = makeSupabase(
      {
        data: {
          id: 'resource-1',
          name: 'Phong facial 01',
          resource_type: 'room',
          status: 'available',
          tenant_id: 'tenant-a',
        },
        error: null,
      },
      { data: [{ id: 'session-2', session_number: 2 }], error: null },
    );

    const result = await validateBookingResourceSchedule({
      supabase: supabase as never,
      tenantId: 'tenant-a',
      bookingResourceId: 'resource-1',
      assignedDate: '2026-06-11',
      assignedTime: '10:00:00',
      status: 'scheduled',
    });

    expect(result).toEqual({ error: 'Tai nguyen Phong facial 01 da co lich trong khung gio nay.' });
    expect(conflictQuery.eq).toHaveBeenCalledWith('tenant_id', 'tenant-a');
    expect(conflictQuery.eq).toHaveBeenCalledWith('booking_resource_id', 'resource-1');
    expect(conflictQuery.eq).toHaveBeenCalledWith('assigned_date', '2026-06-11');
    expect(conflictQuery.in).toHaveBeenCalledWith('assigned_time', ['10:00', '10:00:00']);
    expect(conflictQuery.in).toHaveBeenCalledWith('status', ['scheduled', 'in_progress']);
  });

  it('checks both HH:MM and HH:MM:SS time variants to match database time columns', async () => {
    const { supabase, conflictQuery } = makeSupabase(
      {
        data: {
          id: 'resource-1',
          name: 'Phong facial 01',
          resource_type: 'room',
          status: 'available',
          tenant_id: 'tenant-a',
        },
        error: null,
      },
      { data: [], error: null },
    );

    const result = await validateBookingResourceSchedule({
      supabase: supabase as never,
      tenantId: 'tenant-a',
      bookingResourceId: 'resource-1',
      assignedDate: '2026-06-11',
      assignedTime: '9:00',
      status: 'scheduled',
    });

    expect(result).toEqual({ success: true });
    expect(conflictQuery.in).toHaveBeenCalledWith('assigned_time', ['09:00', '09:00:00']);
  });

  it('excludes the current session when validating an update', async () => {
    const { supabase, conflictQuery } = makeSupabase(
      {
        data: {
          id: 'resource-1',
          name: 'Phong facial 01',
          resource_type: 'room',
          status: 'in_use',
          tenant_id: 'tenant-a',
        },
        error: null,
      },
      { data: [], error: null },
    );

    const result = await validateBookingResourceSchedule({
      supabase: supabase as never,
      tenantId: 'tenant-a',
      sessionId: 'session-1',
      bookingResourceId: 'resource-1',
      assignedDate: '2026-06-11',
      assignedTime: '10:00:00',
      status: 'scheduled',
    });

    expect(result).toEqual({ success: true });
    expect(conflictQuery.neq).toHaveBeenCalledWith('id', 'session-1');
  });
});
