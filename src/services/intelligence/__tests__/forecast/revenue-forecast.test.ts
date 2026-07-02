/**
 * Revenue Forecast Unit Tests
 * Intelligence Layer Phase 8 Task #3
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  calculateSimpleMovingAverage,
  calculateExponentialSmoothing,
  calculateLinearRegression,
  generateRevenueForecast
} from '../../forecast/revenue-forecast';
import { generateMockHistoricalRevenue } from '../helpers/test-utils';

describe('Revenue Forecast - Unit Tests', () => {
  describe('Simple Moving Average (SMA)', () => {
    it('should calculate SMA correctly for 3-month window', () => {
      const data = [
        { month: '2026-01', revenue: 40000000 },
        { month: '2026-02', revenue: 42000000 },
        { month: '2026-03', revenue: 45000000 },
      ];
      
      const result = calculateSimpleMovingAverage(data, 3);
      
      expect(result.forecasted_value).toBe(42333333.33); // (40M + 42M + 45M) / 3
      expect(result.model_name).toBe('simple_moving_average');
      expect(result.confidence_lower).toBeLessThan(result.forecasted_value);
      expect(result.confidence_upper).toBeGreaterThan(result.forecasted_value);
    });

    it('should handle window size larger than data length', () => {
      const data = [
        { month: '2026-01', revenue: 40000000 },
        { month: '2026-02', revenue: 42000000 },
      ];
      
      const result = calculateSimpleMovingAverage(data, 5);
      
      // Should use all available data
      expect(result.forecasted_value).toBe(41000000); // (40M + 42M) / 2
    });

    it('should throw error for empty data', () => {
      expect(() => calculateSimpleMovingAverage([], 3)).toThrow('Insufficient data');
    });

    it('should throw error for window size < 1', () => {
      const data = [{ month: '2026-01', revenue: 40000000 }];
      expect(() => calculateSimpleMovingAverage(data, 0)).toThrow('Window size must be at least 1');
    });
  });

  describe('Exponential Smoothing', () => {
    it('should calculate exponential smoothing correctly', () => {
      const data = [
        { month: '2026-01', revenue: 40000000 },
        { month: '2026-02', revenue: 42000000 },
        { month: '2026-03', revenue: 45000000 },
      ];
      
      const result = calculateExponentialSmoothing(data, 0.3);
      
      expect(result.forecasted_value).toBeGreaterThan(40000000);
      expect(result.forecasted_value).toBeLessThan(50000000);
      expect(result.model_name).toBe('exponential_smoothing');
      expect(result.metadata).toHaveProperty('alpha');
      expect(result.metadata.alpha).toBe(0.3);
    });

    it('should give more weight to recent data with higher alpha', () => {
      const data = [
        { month: '2026-01', revenue: 40000000 },
        { month: '2026-02', revenue: 42000000 },
        { month: '2026-03', revenue: 50000000 }, // Recent spike
      ];
      
      const lowAlpha = calculateExponentialSmoothing(data, 0.1);
      const highAlpha = calculateExponentialSmoothing(data, 0.9);
      
      // Higher alpha gives more weight to recent spike
      expect(highAlpha.forecasted_value).toBeGreaterThan(lowAlpha.forecasted_value);
    });

    it('should throw error for alpha out of range', () => {
      const data = [{ month: '2026-01', revenue: 40000000 }];
      expect(() => calculateExponentialSmoothing(data, 1.5)).toThrow('Alpha must be between 0 and 1');
      expect(() => calculateExponentialSmoothing(data, -0.1)).toThrow('Alpha must be between 0 and 1');
    });
  });

  describe('Linear Regression', () => {
    it('should calculate linear regression with positive trend', () => {
      const data = [
        { month: '2026-01', revenue: 40000000 },
        { month: '2026-02', revenue: 42000000 },
        { month: '2026-03', revenue: 44000000 },
        { month: '2026-04', revenue: 46000000 },
      ];
      
      const result = calculateLinearRegression(data);
      
      expect(result.forecasted_value).toBeGreaterThan(46000000); // Should continue upward trend
      expect(result.model_name).toBe('linear_regression');
      expect(result.metadata).toHaveProperty('slope');
      expect(result.metadata).toHaveProperty('intercept');
      expect(result.metadata).toHaveProperty('r_squared');
      expect(result.metadata.slope).toBeGreaterThan(0); // Positive trend
      expect(result.metadata.r_squared).toBeGreaterThan(0.9); // Perfect linear fit
    });

    it('should calculate linear regression with negative trend', () => {
      const data = [
        { month: '2026-01', revenue: 50000000 },
        { month: '2026-02', revenue: 48000000 },
        { month: '2026-03', revenue: 46000000 },
        { month: '2026-04', revenue: 44000000 },
      ];
      
      const result = calculateLinearRegression(data);
      
      expect(result.forecasted_value).toBeLessThan(44000000); // Should continue downward trend
      expect(result.metadata.slope).toBeLessThan(0); // Negative trend
    });

    it('should require at least 3 data points', () => {
      const data = [
        { month: '2026-01', revenue: 40000000 },
        { month: '2026-02', revenue: 42000000 },
      ];
      
      expect(() => calculateLinearRegression(data)).toThrow('At least 3 data points required');
    });

    it('should calculate R-squared for model fit quality', () => {
      const perfectFit = [
        { month: '2026-01', revenue: 40000000 },
        { month: '2026-02', revenue: 42000000 },
        { month: '2026-03', revenue: 44000000 },
      ];
      
      const noisyFit = [
        { month: '2026-01', revenue: 40000000 },
        { month: '2026-02', revenue: 45000000 },
        { month: '2026-03', revenue: 42000000 },
      ];
      
      const perfectResult = calculateLinearRegression(perfectFit);
      const noisyResult = calculateLinearRegression(noisyFit);
      
      expect(perfectResult.metadata.r_squared).toBeGreaterThan(noisyResult.metadata.r_squared);
      expect(perfectResult.metadata.r_squared).toBeCloseTo(1.0, 1); // Near-perfect fit
    });
  });

  describe('Generate Revenue Forecast (Ensemble)', () => {
    it('should generate forecast using best-performing model', async () => {
      const historicalData = generateMockHistoricalRevenue(12);
      
      const result = await generateRevenueForecast('test-tenant-id', {
        historical_data: historicalData,
        forecast_periods: 1
      });
      
      expect(result).toHaveProperty('forecasted_value');
      expect(result).toHaveProperty('model_name');
      expect(result).toHaveProperty('accuracy_pct');
      expect(result.forecasted_value).toBeGreaterThan(0);
      expect(['simple_moving_average', 'exponential_smoothing', 'linear_regression']).toContain(result.model_name);
    });

    it('should select model with highest accuracy', async () => {
      // Create data with clear linear trend (favors linear regression)
      const linearData = Array.from({ length: 12 }, (_, i) => ({
        month: new Date(2025, i, 1).toISOString().slice(0, 7),
        revenue: 40000000 + i * 2000000 // Perfect linear growth
      }));
      
      const result = await generateRevenueForecast('test-tenant-id', {
        historical_data: linearData,
        forecast_periods: 1
      });
      
      expect(result.model_name).toBe('linear_regression');
      expect(result.accuracy_pct).toBeGreaterThan(80);
    });

    it('should calculate confidence intervals', async () => {
      const historicalData = generateMockHistoricalRevenue(12);
      
      const result = await generateRevenueForecast('test-tenant-id', {
        historical_data: historicalData,
        forecast_periods: 1
      });
      
      expect(result.confidence_lower).toBeLessThan(result.forecasted_value);
      expect(result.confidence_upper).toBeGreaterThan(result.forecasted_value);
      
      // Confidence interval should be reasonable (within 30% of forecast)
      const spread = result.confidence_upper - result.confidence_lower;
      expect(spread).toBeLessThan(result.forecasted_value * 0.6);
    });

    it('should handle multi-period forecasts', async () => {
      const historicalData = generateMockHistoricalRevenue(12);
      
      const result = await generateRevenueForecast('test-tenant-id', {
        historical_data: historicalData,
        forecast_periods: 3
      });
      
      expect(result.metadata).toHaveProperty('multi_period_forecast');
      expect(result.metadata.multi_period_forecast).toHaveLength(3);
      
      // Each period should have increasing values (assuming growth trend)
      const forecasts = result.metadata.multi_period_forecast;
      expect(forecasts[1]).toBeGreaterThanOrEqual(forecasts[0]);
      expect(forecasts[2]).toBeGreaterThanOrEqual(forecasts[1]);
    });

    it('should include model comparison metadata', async () => {
      const historicalData = generateMockHistoricalRevenue(12);
      
      const result = await generateRevenueForecast('test-tenant-id', {
        historical_data: historicalData,
        forecast_periods: 1
      });
      
      expect(result.metadata).toHaveProperty('model_comparison');
      expect(result.metadata.model_comparison).toHaveProperty('sma_accuracy');
      expect(result.metadata.model_comparison).toHaveProperty('es_accuracy');
      expect(result.metadata.model_comparison).toHaveProperty('lr_accuracy');
    });
  });

  describe('Edge Cases', () => {
    it('should handle single data point', () => {
      const data = [{ month: '2026-01', revenue: 40000000 }];
      
      const sma = calculateSimpleMovingAverage(data, 1);
      const es = calculateExponentialSmoothing(data, 0.3);
      
      expect(sma.forecasted_value).toBe(40000000);
      expect(es.forecasted_value).toBe(40000000);
    });

    it('should handle zero revenue data', () => {
      const data = [
        { month: '2026-01', revenue: 0 },
        { month: '2026-02', revenue: 0 },
        { month: '2026-03', revenue: 0 },
      ];
      
      const result = calculateSimpleMovingAverage(data, 3);
      expect(result.forecasted_value).toBe(0);
    });

    it('should handle very large revenue values', () => {
      const data = [
        { month: '2026-01', revenue: 1000000000000 }, // 1 trillion
        { month: '2026-02', revenue: 1100000000000 },
        { month: '2026-03', revenue: 1200000000000 },
      ];
      
      const result = calculateLinearRegression(data);
      expect(result.forecasted_value).toBeGreaterThan(1200000000000);
      expect(Number.isFinite(result.forecasted_value)).toBe(true);
    });

    it('should handle volatile data (high variance)', () => {
      const data = [
        { month: '2026-01', revenue: 40000000 },
        { month: '2026-02', revenue: 80000000 },
        { month: '2026-03', revenue: 30000000 },
        { month: '2026-04', revenue: 70000000 },
      ];
      
      const result = calculateLinearRegression(data);
      
      // Wide confidence interval for volatile data
      const spread = result.confidence_upper - result.confidence_lower;
      expect(spread).toBeGreaterThan(result.forecasted_value * 0.3);
    });
  });
});
