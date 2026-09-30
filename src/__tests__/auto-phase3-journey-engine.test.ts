import { describe, it, expect } from '@jest/globals';
import { CustomerJourneyService } from '@/modules/bella-auto/services/CustomerJourneyService';
import { JourneySLAMonitorService } from '@/modules/bella-auto/services/JourneySLAMonitorService';

type MockRow = Record<string, unknown>;
type MockDbState = Record<string, MockRow[] | MockRow | undefined>;
type MockChain = {
  eq: (field: string, value: unknown) => MockChain;
  single: () => Promise<{ data: MockRow; error: null }>;
  maybeSingle: () => Promise<{ data: MockRow | null; error: null }>;
  order: () => Promise<{ data: MockRow[]; error: null }>;
};

// Mock DB state
function makeSupabaseMock(dbState: MockDbState) {
  const rowsFor = (table: string): MockRow[] => {
    const rows = dbState[table];
    return Array.isArray(rows) ? rows : [];
  };

  const matchesFilters = (row: MockRow, filters: Record<string, unknown>) =>
    Object.entries(filters).every(([field, value]) => row[field] === value);

  const makeChain = (table: string): MockChain => {
    const filters: Record<string, unknown> = {};
    const findRow = () => {
      const rows = rowsFor(table);
      return rows.find((row) => matchesFilters(row, filters)) ?? rows[0];
    };

    const chain: MockChain = {
      eq: (field, value) => {
        filters[field] = value;
        return chain;
      },
      single: () => {
        const row = findRow();
        if (row) {
          return Promise.resolve({ data: row, error: null });
        }
        if (dbState.singleOverride && !Array.isArray(dbState.singleOverride)) {
          return Promise.resolve({ data: dbState.singleOverride, error: null });
        }
        return Promise.resolve({ data: { id: 'test-id', sla_hours: 24, code: 'lead_new', name: 'Lead Mới' }, error: null });
      },
      maybeSingle: () => Promise.resolve({ data: findRow() ?? { id: 'journey-001' }, error: null }),
      order: () => Promise.resolve({ data: rowsFor(table), error: null }),
    };

    return chain;
  };

  return {
    from: (table: string) => {
      return {
        select: (_columns?: string) => {
          if (table === 'auto_touchpoints') {
            return {
              eq: () => ({
                eq: () => ({
                  order: () => Promise.resolve({ data: Array.isArray(dbState.auto_touchpoints) ? dbState.auto_touchpoints : [], error: null })
                })
              })
            };
          }
          return makeChain(table);
        },
        upsert: (payload: MockRow) => {
          if (!Array.isArray(dbState[table])) dbState[table] = [];
          (dbState[table] as MockRow[]).push(payload);
          return {
            select: () => ({
              single: () => Promise.resolve({ data: { id: 'journey-001' }, error: null })
            })
          };
        },
        insert: (payload: MockRow) => {
          if (!Array.isArray(dbState[table])) dbState[table] = [];
          (dbState[table] as MockRow[]).push(payload);
          return {
            select: () => ({
              single: () => Promise.resolve({ data: { id: 'inserted-id' }, error: null })
            })
          };
        },
        update: (payload: MockRow) => {
          if (Array.isArray(dbState.auto_customer_journeys)) {
            dbState.auto_customer_journeys[0] = { ...dbState.auto_customer_journeys[0], ...payload };
          }
          return makeChain(table);
        }
      };
    }
  };
}

describe('Phase 3: Journey Engine & Experience Management — Unit Tests', () => {

  it('should start journey for customer and record first event', async () => {
    const dbState: MockDbState = { auto_customer_journeys: [], auto_journey_events: [] };
    const supabase = makeSupabaseMock(dbState);

    const result = await CustomerJourneyService.startJourney(supabase, 'tenant-001', 'cust-001', 'lead_new');

    expect(result.journeyId).toBe('journey-001');
    expect(dbState.auto_customer_journeys.length).toBe(1);
    expect(dbState.auto_journey_events.length).toBe(1);
  });

  it('should transition stage, calculate duration_hours and log event', async () => {
    const enteredDate = new Date();
    enteredDate.setHours(enteredDate.getHours() - 5); // 5 hours ago

    const dbState: MockDbState = {
      auto_customer_journeys: [
        {
          id: 'journey-001',
          entered_stage_at: enteredDate.toISOString(),
          current_stage_id: 'old-stage-id',
          auto_journey_stages: { code: 'lead_new', name: 'Lead Mới' }
        }
      ],
      auto_journey_stages: [
        { id: 'old-stage-id', code: 'lead_new', name: 'Lead Mới', sla_hours: 24 },
        { id: 'target-stage-id', code: 'test_drive', name: 'Lái thử', sla_hours: 48 }
      ],
      auto_journey_events: []
    };

    const supabase = makeSupabaseMock(dbState);

    const result = await CustomerJourneyService.transitionStage(supabase, {
      tenantId: 'tenant-001',
      customerId: 'cust-001',
      toStageCode: 'test_drive',
      reason: 'Đăng ký lái thử thành công'
    });

    expect(result.success).toBe(true);
    expect(result.fromStageCode).toBe('lead_new');
    expect(result.toStageCode).toBe('test_drive');
    
    // Duration hours should be close to 5
    expect(dbState.auto_journey_events.length).toBe(1);
    expect(dbState.auto_journey_events[0].duration_hours).toBeCloseTo(5, 1);
    expect(dbState.auto_journey_events[0].reason).toBe('Đăng ký lái thử thành công');
  });

  it('should record & list customer touchpoints', async () => {
    const dbState: MockDbState = { auto_touchpoints: [] };
    const supabase = makeSupabaseMock(dbState);

    const touchId = await JourneySLAMonitorService.recordTouchpoint(supabase, {
      tenantId: 'tenant-001',
      customerId: 'cust-001',
      channel: 'zalo',
      title: 'Gửi bảng giá chi tiết',
      content: 'Báo giá lăn bánh BMW M4'
    });

    expect(touchId).toBe('inserted-id');
    expect(dbState.auto_touchpoints.length).toBe(1);
    expect(dbState.auto_touchpoints[0].channel).toBe('zalo');
  });
});
