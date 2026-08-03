import { describe, it, expect } from '@jest/globals';
import { CustomerJourneyService } from '@/modules/bella-auto/services/CustomerJourneyService';
import { JourneySLAMonitorService } from '@/modules/bella-auto/services/JourneySLAMonitorService';

// Mock DB state
function makeSupabaseMock(dbState: any) {
  const chain: any = {};
  chain.eq = (field: string, value: any) => {
    return chain;
  };
  chain.single = () => {
    if (dbState.singleOverride) {
      return Promise.resolve({ data: dbState.singleOverride, error: null });
    }
    return Promise.resolve({ data: { id: 'test-id', sla_hours: 24, code: 'lead_new', name: 'Lead Mới' }, error: null });
  };
  chain.maybeSingle = () => {
    return Promise.resolve({ data: { id: 'journey-001' }, error: null });
  };
  chain.order = () => {
    return Promise.resolve({ data: dbState.auto_journey_events ?? [], error: null });
  };

  return {
    from: (table: string) => {
      return {
        select: (columns?: string) => {
          if (table === 'auto_customer_journeys') {
            if (dbState.auto_customer_journeys) {
              return {
                eq: (f1: string, v1: any) => ({
                  eq: (f2: string, v2: any) => ({
                    single: () => Promise.resolve({ data: dbState.auto_customer_journeys[0], error: null })
                  })
                })
              };
            }
            return chain;
          }
          if (table === 'auto_touchpoints') {
            return {
              eq: () => ({
                eq: () => ({
                  order: () => Promise.resolve({ data: dbState.auto_touchpoints ?? [], error: null })
                })
              })
            };
          }
          return chain;
        },
        upsert: (payload: any) => {
          if (!dbState[table]) dbState[table] = [];
          dbState[table].push(payload);
          return {
            select: () => ({
              single: () => Promise.resolve({ data: { id: 'journey-001' }, error: null })
            })
          };
        },
        insert: (payload: any) => {
          if (!dbState[table]) dbState[table] = [];
          dbState[table].push(payload);
          return {
            select: () => ({
              single: () => Promise.resolve({ data: { id: 'inserted-id' }, error: null })
            })
          };
        },
        update: (payload: any) => {
          if (dbState.auto_customer_journeys) {
            dbState.auto_customer_journeys[0] = { ...dbState.auto_customer_journeys[0], ...payload };
          }
          return chain;
        }
      } as any;
    }
  } as any;
}

describe('Phase 3: Journey Engine & Experience Management — Unit Tests', () => {

  it('should start journey for customer and record first event', async () => {
    const dbState: any = { auto_customer_journeys: [], auto_journey_events: [] };
    const supabase = makeSupabaseMock(dbState);

    const result = await CustomerJourneyService.startJourney(supabase, 'tenant-001', 'cust-001', 'lead_new');

    expect(result.journeyId).toBe('journey-001');
    expect(dbState.auto_customer_journeys.length).toBe(1);
    expect(dbState.auto_journey_events.length).toBe(1);
  });

  it('should transition stage, calculate duration_hours and log event', async () => {
    const enteredDate = new Date();
    enteredDate.setHours(enteredDate.getHours() - 5); // 5 hours ago

    const dbState: any = {
      singleOverride: { id: 'target-stage-id', name: 'Lái thử', sla_hours: 48 },
      auto_customer_journeys: [
        {
          id: 'journey-001',
          entered_stage_at: enteredDate.toISOString(),
          current_stage_id: 'old-stage-id',
          auto_journey_stages: { code: 'lead_new', name: 'Lead Mới' }
        }
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
    const dbState: any = { auto_touchpoints: [] };
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
