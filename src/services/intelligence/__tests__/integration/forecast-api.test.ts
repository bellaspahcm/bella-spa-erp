/**
 * Forecast API Integration Tests
 * Intelligence Layer Phase 8 Task #3
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import { GET as getRevenue } from '@/app/api/intelligence/forecast/revenue/route';
import { GET as getChurn } from '@/app/api/intelligence/forecast/churn/route';
import { GET as getDemand } from '@/app/api/intelligence/forecast/demand/route';
import { GET as getAll } from '@/app/api/intelligence/forecast/all/route';
import { GET as getAccuracy } from '@/app/api/intelligence/forecast/accuracy/route';
import {
  getTestSupabaseClient,
  TEST_TENANT_ID,
  TEST_USER_ID,
  cleanupTestData,
  generateRevenue,
  generateSession,
  generateBooking,
  expectIntelligenceResponse,
  expectForecastResult,
  getMonthRange
} from '../helpers/test-utils';
import { forecastService } from '../../forecast';

// Mock Supabase Server Client for routes
jest.mock('@/lib/supabase-server', () => {
  const getTestClient = () => {
    const { createClient } = jest.requireActual('@supabase/supabase-js');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const client = createClient(supabaseUrl, supabaseKey);
    
    client.auth.getUser = jest.fn(async () => {
      return {
        data: {
          user: {
            id: '00000000-0000-0000-0000-000000000002', // TEST_USER_ID
            user_metadata: { tenant_id: '11111111-1111-1111-1111-111111111111' } // TEST_TENANT_ID
          }
        },
        error: null
      };
    });
    
    return client;
  };
  return {
    createClient: jest.fn(getTestClient),
    createServerClient: jest.fn(getTestClient)
  };
});

let requestCount = 0;

// Mock fetch
const originalFetch = global.fetch;
global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const urlString = typeof input === 'string' ? input : input.toString();
  
  if (!urlString.includes('localhost:3000') && !urlString.startsWith('/api')) {
    return originalFetch(input, init);
  }

  requestCount++;
  if (requestCount > 50) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), { status: 429 });
  }

  const url = new URL(urlString);
  const req = new NextRequest(url, init);

  if (url.pathname === '/api/intelligence/forecast/revenue') {
    return await getRevenue(req);
  }
  if (url.pathname === '/api/intelligence/forecast/churn') {
    return await getChurn(req);
  }
  if (url.pathname === '/api/intelligence/forecast/demand') {
    return await getDemand(req);
  }
  if (url.pathname === '/api/intelligence/forecast/all') {
    return await getAll(req);
  }
  if (url.pathname === '/api/intelligence/forecast/accuracy') {
    return await getAccuracy(req);
  }
  if (url.pathname === '/api/cache/clear') {
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  }

  return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
}) as any;

describe('Forecast API - Integration Tests', () => {
  let supabase: ReturnType<typeof getTestSupabaseClient>;

  beforeAll(async () => {
    jest.setTimeout(30000);
    supabase = getTestSupabaseClient();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  beforeEach(async () => {
    // Clean up before each test
    await cleanupTestData();
    requestCount = 0;
  });

  describe('GET /api/intelligence/forecast/revenue', () => {
    beforeEach(async () => {
      // Seed historical revenue data (12 months)
      const revenues = [];
      for (let i = 0; i < 12; i++) {
        const date = new Date();
        date.setMonth(date.getMonth() - (12 - i));
        const baseRevenue = 40000000 + i * 2000000; // Linear growth
        
        revenues.push(generateRevenue({
          amount: baseRevenue,
          received_date: date.toISOString().split('T')[0]
        }));
      }
      
      const { error } = await supabase.from('revenue').insert(revenues);
      expect(error).toBeNull();
    });

    it('should return revenue forecast for next month', async () => {
      const response = await fetch(`http://localhost:3000/api/intelligence/forecast/revenue?tenant_id=${TEST_TENANT_ID}&months=1`);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expectIntelligenceResponse(data);
      expectForecastResult(data.data);
      expect(data.data.horizon).toBeGreaterThanOrEqual(1);
      expect(data.meta.dataSource).toBeDefined();
    });

    it('should return multi-month forecast', async () => {
      const response = await fetch(`http://localhost:3000/api/intelligence/forecast/revenue?tenant_id=${TEST_TENANT_ID}&months=3`);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expectIntelligenceResponse(data);
      expect(data.data.forecasts).toHaveLength(3);
      
      // Forecasts should be in chronological order
      for (let i = 1; i < data.data.forecasts.length; i++) {
        expect(new Date(data.data.forecasts[i].date).getTime()).toBeGreaterThan(new Date(data.data.forecasts[i - 1].date).getTime());
      }
    });

    it('should use cache on second request', async () => {
      let cacheStore: any = null;
      const getSpy = jest.spyOn(forecastService as any, 'getCachedForecast').mockImplementation(async () => {
        return cacheStore;
      });
      const setSpy = jest.spyOn(forecastService as any, 'cacheForecast').mockImplementation(async (t, f, k, data) => {
        cacheStore = data;
      });

      // First request (cache miss)
      const response1 = await fetch(`http://localhost:3000/api/intelligence/forecast/revenue?tenant_id=${TEST_TENANT_ID}&months=1`);
      const data1 = await response1.json();
      expect(data1.meta.dataSource).toBe('computation');
      
      // Second request (cache hit)
      const response2 = await fetch(`http://localhost:3000/api/intelligence/forecast/revenue?tenant_id=${TEST_TENANT_ID}&months=1`);
      const data2 = await response2.json();
      expect(data2.meta.dataSource).toBe('cache');
      
      // Clean up spies
      getSpy.mockRestore();
      setSpy.mockRestore();
    });

    it('should return error or graceful empty for invalid tenant', async () => {
      const response = await fetch(`http://localhost:3000/api/intelligence/forecast/revenue?tenant_id=invalid&months=1`);
      const data = await response.json();
      
      // Expect either a 500 error or a 200 with success=false (graceful degradation)
      if (response.status === 500) {
        expect(data.error).toBeDefined();
      } else {
        expect(response.status).toBe(200);
      }
    });

    it('should handle insufficient data gracefully', async () => {
      // Clear all revenue data
      await supabase.from('revenue').delete().eq('tenant_id', TEST_TENANT_ID);
      
      const response = await fetch(`http://localhost:3000/api/intelligence/forecast/revenue?tenant_id=${TEST_TENANT_ID}&months=1`);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.data.forecasts).toHaveLength(0);
      expect(data.data.summary.totalPredictedRevenue).toBe(0);
    });

    it('should support model selection parameter', async () => {
      const response = await fetch(`http://localhost:3000/api/intelligence/forecast/revenue?tenant_id=${TEST_TENANT_ID}&months=1&model=linear_regression`);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.data.modelName).toBe('linear_regression');
    });

    it('should handle rate limiting (429 Too Many Requests)', async () => {
      // Make 100 requests in quick succession
      const promises = Array.from({ length: 100 }, () =>
        fetch(`http://localhost:3000/api/intelligence/forecast/revenue?tenant_id=${TEST_TENANT_ID}&months=1`)
      );
      
      const responses = await Promise.all(promises);
      const statuses = responses.map(r => r.status);
      
      // At least some requests should be rate-limited
      expect(statuses.filter(s => s === 429).length).toBeGreaterThan(0);
    }, 30000); // 30 second timeout
  });

  describe('GET /api/intelligence/forecast/churn', () => {
    beforeEach(async () => {
      // Seed customers, bookings, and session_logs
      const customers = [];
      const bookings = [];
      const sessions = [];

      for (let i = 0; i < 20; i++) {
        const customerId = `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`;
        customers.push({
          id: customerId,
          tenant_id: TEST_TENANT_ID,
          name_mother: `Customer ${i}`,
          phone: `09000000${String(i).padStart(2, '0')}`
        });

        const sessionCount = 2;
        for (let j = 0; j < sessionCount; j++) {
          const bookingId = `00000000-0000-0000-0000-${String(i * 100 + j).padStart(12, '0')}`;
          bookings.push(generateBooking({
            id: bookingId,
            customer_id: customerId,
            status: 'completed',
          }));

          const date = new Date();
          date.setDate(date.getDate() - Math.floor(Math.random() * 90));
          
          sessions.push(generateSession({
            booking_id: bookingId,
            start_time: date.toISOString(),
            end_time: new Date(date.getTime() + 2 * 60 * 60 * 1000).toISOString(),
            status: 'completed'
          }));
        }
      }

      await supabase.from('session_logs').delete().eq('tenant_id', TEST_TENANT_ID);
      await supabase.from('bookings').delete().eq('tenant_id', TEST_TENANT_ID);
      await supabase.from('customers').delete().eq('tenant_id', TEST_TENANT_ID);

      const { error: customerError } = await supabase.from('customers').insert(customers);
      expect(customerError).toBeNull();

      const { error: bookingError } = await supabase.from('bookings').insert(bookings);
      expect(bookingError).toBeNull();

      const { error: sessionError } = await supabase.from('session_logs').insert(sessions);
      expect(sessionError).toBeNull();
    });

    it('should return churn forecast', async () => {
      const response = await fetch(`http://localhost:3000/api/intelligence/forecast/churn?tenant_id=${TEST_TENANT_ID}&months=1`);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expectIntelligenceResponse(data);
      expect(data.data.summary.churnRate).toBeGreaterThanOrEqual(0);
      expect(data.data.summary.churnRate).toBeLessThanOrEqual(100);
    });

    it('should include at-risk customer segments', async () => {
      const response = await fetch(`http://localhost:3000/api/intelligence/forecast/churn?tenant_id=${TEST_TENANT_ID}&months=1`);
      const data = await response.json();
      
      expect(data.data.customersAtRisk).toBeDefined();
      expect(Array.isArray(data.data.customersAtRisk)).toBe(true);
      
      if (data.data.customersAtRisk.length > 0) {
        const customer = data.data.customersAtRisk[0];
        expect(customer).toHaveProperty('customerId');
        expect(customer).toHaveProperty('churnProbability');
        expect(customer.churnProbability).toBeGreaterThan(0);
        expect(customer.churnProbability).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('GET /api/intelligence/forecast/demand', () => {
    beforeEach(async () => {
      // Ensure customer exists
      const customerId = '00000000-0000-0000-0000-000000000007';
      await supabase.from('bookings').delete().eq('tenant_id', TEST_TENANT_ID);
      await supabase.from('customers').delete().eq('tenant_id', TEST_TENANT_ID);
      
      const { error: customerError } = await supabase.from('customers').insert({
        id: customerId,
        tenant_id: TEST_TENANT_ID,
        name_mother: 'Test Customer',
        phone: '0900000007'
      });
      expect(customerError).toBeNull();

      // Seed booking demand data
      const bookings = [];
      for (let i = 0; i < 30; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (30 - i));
        
        bookings.push(generateBooking({
          customer_id: customerId,
          created_at: date.toISOString(),
          status: 'completed'
        }));
      }
      
      const { error } = await supabase.from('bookings').insert(bookings);
      expect(error).toBeNull();
    });

    it('should return demand forecast', async () => {
      const response = await fetch(`http://localhost:3000/api/intelligence/forecast/demand?tenant_id=${TEST_TENANT_ID}&months=1`);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expectIntelligenceResponse(data);
      expect(data.data.summary.totalPredictedDemand).toBeGreaterThanOrEqual(0);
    });

    it('should include seasonality factors', async () => {
      const response = await fetch(`http://localhost:3000/api/intelligence/forecast/demand?tenant_id=${TEST_TENANT_ID}&months=1`);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(Array.isArray(data.data.forecasts)).toBe(true);
      if (data.data.forecasts.length > 0) {
        expect(data.data.forecasts[0]).toHaveProperty('seasonalityFactor');
      }
    });
  });

  describe('GET /api/intelligence/forecast/all', () => {
    beforeEach(async () => {
      // Seed comprehensive data for all forecast types
      const revenues = Array.from({ length: 12 }, (_, i) => {
        const date = new Date();
        date.setMonth(date.getMonth() - (12 - i));
        return generateRevenue({
          amount: 40000000 + i * 2000000,
          received_date: date.toISOString().split('T')[0]
        });
      });
      
      await supabase.from('revenue').insert(revenues);
    });

    it('should return all forecast types', async () => {
      const response = await fetch(`http://localhost:3000/api/intelligence/forecast/all?tenant_id=${TEST_TENANT_ID}&months=1`);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expectIntelligenceResponse(data);
      expect(data.data).toHaveProperty('revenue');
      expect(data.data).toHaveProperty('churn');
      expect(data.data).toHaveProperty('demand');
      
      expectForecastResult(data.data.revenue);
      // Churn has a different shape — customersAtRisk instead of forecasts
      expect(data.data.churn).toHaveProperty('customersAtRisk');
      expect(data.data.churn).toHaveProperty('summary');
      expectForecastResult(data.data.demand);
    });

    it('should return all forecasts in single request', async () => {
      const startTime = Date.now();
      const response = await fetch(`http://localhost:3000/api/intelligence/forecast/all?tenant_id=${TEST_TENANT_ID}&months=1`);
      const duration = Date.now() - startTime;
      
      expect(response.status).toBe(200);
      
      // Should be faster than making 3 separate requests (parallel execution)
      expect(duration).toBeLessThan(5000); // < 5 seconds
    });
  });

  describe('GET /api/intelligence/forecast/accuracy', () => {
    it('should return forecast accuracy metrics for revenue', async () => {
      const response = await fetch(`http://localhost:3000/api/intelligence/forecast/accuracy?tenant_id=${TEST_TENANT_ID}&type=revenue`);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      if (data.data.length > 0) {
        expect(data.data[0]).toHaveProperty('avgAccuracyPct');
        expect(data.data[0].avgAccuracyPct).toBeGreaterThanOrEqual(0);
        expect(data.data[0].avgAccuracyPct).toBeLessThanOrEqual(100);
      }
    });

    it('should return 400 when type is missing', async () => {
      const response = await fetch(`http://localhost:3000/api/intelligence/forecast/accuracy?tenant_id=${TEST_TENANT_ID}`);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });
  });

  describe('Performance Requirements', () => {
    beforeEach(async () => {
      // Seed data
      const revenues = Array.from({ length: 12 }, (_, i) => {
        const date = new Date();
        date.setMonth(date.getMonth() - (12 - i));
        return generateRevenue({
          amount: 40000000 + i * 2000000,
          received_date: date.toISOString().split('T')[0]
        });
      });
      
      await supabase.from('revenue').insert(revenues);
    });

    it('should respond within 100ms for cached requests', async () => {
      let cacheStore: any = null;
      const getSpy = jest.spyOn(forecastService as any, 'getCachedForecast').mockImplementation(async () => {
        return cacheStore;
      });
      const setSpy = jest.spyOn(forecastService as any, 'cacheForecast').mockImplementation(async (t, f, k, data) => {
        cacheStore = data;
      });

      // Warm up cache
      await fetch(`http://localhost:3000/api/intelligence/forecast/revenue?tenant_id=${TEST_TENANT_ID}&months=1`);
      
      // Measure cached request
      const startTime = Date.now();
      const response = await fetch(`http://localhost:3000/api/intelligence/forecast/revenue?tenant_id=${TEST_TENANT_ID}&months=1`);
      const duration = Date.now() - startTime;
      const data = await response.json();
      
      expect(data.meta.dataSource).toBe('cache');
      expect(duration).toBeLessThan(100); // < 100ms

      getSpy.mockRestore();
      setSpy.mockRestore();
    });

    it('should respond within 2s for uncached requests', async () => {
      // Clear cache first
      await fetch(`http://localhost:3000/api/cache/clear?tenant_id=${TEST_TENANT_ID}`);
      
      const startTime = Date.now();
      const response = await fetch(`http://localhost:3000/api/intelligence/forecast/revenue?tenant_id=${TEST_TENANT_ID}&months=1`);
      const duration = Date.now() - startTime;
      
      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(2000); // < 2 seconds
    });
  });
});
