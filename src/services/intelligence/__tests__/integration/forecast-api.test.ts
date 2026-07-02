/**
 * Forecast API Integration Tests
 * Intelligence Layer Phase 8 Task #3
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import {
  getTestSupabaseClient,
  TEST_TENANT_ID,
  cleanupTestData,
  generateRevenue,
  generateSession,
  generateBooking,
  expectIntelligenceResponse,
  expectForecastResult,
  getMonthRange
} from '../helpers/test-utils';

describe('Forecast API - Integration Tests', () => {
  let supabase: ReturnType<typeof getTestSupabaseClient>;

  beforeAll(async () => {
    supabase = getTestSupabaseClient();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  beforeEach(async () => {
    // Clean up before each test
    await cleanupTestData();
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
          payment_date: date.toISOString().split('T')[0]
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
      expect(data.data.forecast_type).toBe('revenue');
      expect(data.metadata.cached).toBeDefined();
    });

    it('should return multi-month forecast', async () => {
      const response = await fetch(`http://localhost:3000/api/intelligence/forecast/revenue?tenant_id=${TEST_TENANT_ID}&months=3`);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expectIntelligenceResponse(data);
      expect(data.data).toHaveLength(3);
      
      // Forecasts should be in chronological order
      for (let i = 1; i < data.data.length; i++) {
        expect(data.data[i].period_start_date).toBeGreaterThan(data.data[i - 1].period_end_date);
      }
    });

    it('should use cache on second request', async () => {
      // First request (cache miss)
      const response1 = await fetch(`http://localhost:3000/api/intelligence/forecast/revenue?tenant_id=${TEST_TENANT_ID}&months=1`);
      const data1 = await response1.json();
      expect(data1.metadata.cached).toBe(false);
      
      // Second request (cache hit)
      const response2 = await fetch(`http://localhost:3000/api/intelligence/forecast/revenue?tenant_id=${TEST_TENANT_ID}&months=1`);
      const data2 = await response2.json();
      expect(data2.metadata.cached).toBe(true);
      
      // Execution time should be much faster for cached request
      expect(data2.metadata.execution_time_ms).toBeLessThan(data1.metadata.execution_time_ms);
    });

    it('should return error for invalid tenant', async () => {
      const response = await fetch(`http://localhost:3000/api/intelligence/forecast/revenue?tenant_id=invalid&months=1`);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    it('should return error for insufficient data', async () => {
      // Clear all revenue data
      await supabase.from('revenue').delete().eq('tenant_id', TEST_TENANT_ID);
      
      const response = await fetch(`http://localhost:3000/api/intelligence/forecast/revenue?tenant_id=${TEST_TENANT_ID}&months=1`);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Insufficient');
    });

    it('should support model selection parameter', async () => {
      const response = await fetch(`http://localhost:3000/api/intelligence/forecast/revenue?tenant_id=${TEST_TENANT_ID}&months=1&model=linear_regression`);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.data.model_name).toBe('linear_regression');
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
      // Seed customer activity data
      const sessions = [];
      const customers = Array.from({ length: 50 }, (_, i) => `customer_${i}`);
      
      for (const customerId of customers) {
        const sessionCount = Math.floor(Math.random() * 10) + 1;
        for (let i = 0; i < sessionCount; i++) {
          const date = new Date();
          date.setDate(date.getDate() - Math.floor(Math.random() * 90));
          
          sessions.push(generateSession({
            booking_id: `booking_${customerId}_${i}`,
            start_time: date.toISOString(),
            end_time: new Date(date.getTime() + 2 * 60 * 60 * 1000).toISOString()
          }));
        }
      }
      
      const { error } = await supabase.from('sessions').insert(sessions);
      expect(error).toBeNull();
    });

    it('should return churn forecast', async () => {
      const response = await fetch(`http://localhost:3000/api/intelligence/forecast/churn?tenant_id=${TEST_TENANT_ID}&months=1`);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expectIntelligenceResponse(data);
      expect(data.data.forecast_type).toBe('churn');
      expect(data.data.forecasted_value).toBeGreaterThanOrEqual(0);
      expect(data.data.forecasted_value).toBeLessThanOrEqual(100); // Churn rate percentage
    });

    it('should include at-risk customer segments', async () => {
      const response = await fetch(`http://localhost:3000/api/intelligence/forecast/churn?tenant_id=${TEST_TENANT_ID}&months=1`);
      const data = await response.json();
      
      expect(data.data.metadata).toHaveProperty('at_risk_customers');
      expect(Array.isArray(data.data.metadata.at_risk_customers)).toBe(true);
      
      if (data.data.metadata.at_risk_customers.length > 0) {
        const customer = data.data.metadata.at_risk_customers[0];
        expect(customer).toHaveProperty('customer_id');
        expect(customer).toHaveProperty('churn_probability');
        expect(customer.churn_probability).toBeGreaterThan(0);
        expect(customer.churn_probability).toBeLessThan(1);
      }
    });
  });

  describe('GET /api/intelligence/forecast/demand', () => {
    beforeEach(async () => {
      // Seed booking demand data
      const bookings = [];
      for (let i = 0; i < 30; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (30 - i));
        
        bookings.push(generateBooking({
          created_at: date.toISOString(),
          status: 'active'
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
      expect(data.data.forecast_type).toBe('demand');
      expect(data.data.forecasted_value).toBeGreaterThan(0); // Number of bookings expected
    });

    it('should include seasonality factors', async () => {
      const response = await fetch(`http://localhost:3000/api/intelligence/forecast/demand?tenant_id=${TEST_TENANT_ID}&months=1`);
      const data = await response.json();
      
      expect(data.data.metadata).toHaveProperty('seasonality');
      expect(typeof data.data.metadata.seasonality).toBe('object');
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
          payment_date: date.toISOString().split('T')[0]
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
      expectForecastResult(data.data.churn);
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
    it('should return forecast accuracy metrics', async () => {
      const response = await fetch(`http://localhost:3000/api/intelligence/forecast/accuracy?tenant_id=${TEST_TENANT_ID}`);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expectIntelligenceResponse(data);
      expect(data.data).toHaveProperty('revenue_accuracy');
      expect(data.data).toHaveProperty('churn_accuracy');
      expect(data.data).toHaveProperty('demand_accuracy');
      
      // Each accuracy metric should be 0-100%
      expect(data.data.revenue_accuracy).toBeGreaterThanOrEqual(0);
      expect(data.data.revenue_accuracy).toBeLessThanOrEqual(100);
    });

    it('should include model comparison', async () => {
      const response = await fetch(`http://localhost:3000/api/intelligence/forecast/accuracy?tenant_id=${TEST_TENANT_ID}`);
      const data = await response.json();
      
      expect(data.data.metadata).toHaveProperty('best_model_by_type');
      expect(data.data.metadata.best_model_by_type).toHaveProperty('revenue');
      expect(['simple_moving_average', 'exponential_smoothing', 'linear_regression']).toContain(
        data.data.metadata.best_model_by_type.revenue
      );
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
          payment_date: date.toISOString().split('T')[0]
        });
      });
      
      await supabase.from('revenue').insert(revenues);
    });

    it('should respond within 100ms for cached requests', async () => {
      // Warm up cache
      await fetch(`http://localhost:3000/api/intelligence/forecast/revenue?tenant_id=${TEST_TENANT_ID}&months=1`);
      
      // Measure cached request
      const startTime = Date.now();
      const response = await fetch(`http://localhost:3000/api/intelligence/forecast/revenue?tenant_id=${TEST_TENANT_ID}&months=1`);
      const duration = Date.now() - startTime;
      const data = await response.json();
      
      expect(data.metadata.cached).toBe(true);
      expect(duration).toBeLessThan(100); // < 100ms
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
