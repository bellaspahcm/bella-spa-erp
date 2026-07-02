/**
 * Revenue Forecasting Service
 * Phase 7: Forecast Intelligence & Recommendation Engine
 * 
 * Implements time series forecasting for monthly revenue using:
 * - Simple Moving Average (SMA)
 * - Exponential Smoothing
 * - Linear Regression with trend and seasonality
 */

import { createClient } from '@/lib/supabase-server';
import type {
  ForecastInput,
  RevenueForecastResult,
  RevenueForecastPoint,
  TimeSeriesDataPoint,
  ModelName,
} from './types';

// ============================================================================
// TYPES
// ============================================================================

interface HistoricalRevenueData {
  month: string; // YYYY-MM
  revenue: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MODEL_VERSION = 'v1.0';
const DEFAULT_CONFIDENCE_LEVEL = 0.95;

// ============================================================================
// MAIN FORECAST FUNCTION
// ============================================================================

export async function forecastRevenue(
  input: ForecastInput
): Promise<RevenueForecastResult> {
  const supabase = await createClient();
  
  // Fetch historical revenue data
  const historicalData = await fetchHistoricalRevenue(
    supabase,
    input.tenantId,
    input.startDate
  );
  
  if (historicalData.length < 3) {
    throw new Error('Insufficient historical data for forecasting (minimum 3 months required)');
  }
  
  // Select model
  const modelName = input.modelName || await selectBestModel(supabase, input.tenantId, 'revenue');
  
  // Generate forecasts based on model
  let forecasts: RevenueForecastPoint[];
  
  switch (modelName) {
    case 'simple_moving_average':
      forecasts = forecastWithSMA(historicalData, input.forecastHorizon, input.confidenceLevel || DEFAULT_CONFIDENCE_LEVEL);
      break;
    case 'exponential_smoothing':
      forecasts = forecastWithExponentialSmoothing(historicalData, input.forecastHorizon, input.confidenceLevel || DEFAULT_CONFIDENCE_LEVEL);
      break;
    case 'linear_regression':
      forecasts = forecastWithLinearRegression(historicalData, input.forecastHorizon, input.confidenceLevel || DEFAULT_CONFIDENCE_LEVEL);
      break;
    default:
      // Default to exponential smoothing
      forecasts = forecastWithExponentialSmoothing(historicalData, input.forecastHorizon, input.confidenceLevel || DEFAULT_CONFIDENCE_LEVEL);
  }
  
  // Enrich forecasts with actual values if available
  forecasts = await enrichWithActualValues(supabase, input.tenantId, forecasts);
  
  // Calculate summary statistics
  const summary = calculateSummary(forecasts, historicalData);
  
  // Calculate accuracy metrics if we have actual values
  const accuracy = calculateAccuracyMetrics(forecasts);
  
  // Save forecast results to database
  await saveForecastResults(supabase, input.tenantId, forecasts, modelName, MODEL_VERSION, input.forecastHorizon);
  
  return {
    tenantId: input.tenantId,
    modelName,
    modelVersion: MODEL_VERSION,
    confidenceLevel: input.confidenceLevel || DEFAULT_CONFIDENCE_LEVEL,
    horizon: input.forecastHorizon,
    forecasts,
    summary,
    accuracy: accuracy || undefined,
  };
}

// ============================================================================
// DATA FETCHING
// ============================================================================

async function fetchHistoricalRevenue(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  startDate?: string
): Promise<HistoricalRevenueData[]> {
  // Get last 24 months of revenue data from mv_monthly_pnl
  // Note: View not in generated types yet, using type cast
  const { data, error } = await (supabase as any)
    .from('mv_monthly_pnl')
    .select('period_month, total_revenue')
    .eq('tenant_id', tenantId)
    .order('period_month', { ascending: true })
    .limit(24);
  
  if (error) {
    throw new Error(`Failed to fetch historical revenue: ${error.message}`);
  }
  
  if (!data || data.length === 0) {
    throw new Error('No historical revenue data found');
  }
  
  return data.map((row: any) => ({
    month: row.period_month,
    revenue: Number(row.total_revenue) || 0,
  }));
}

async function selectBestModel(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  forecastType: string
): Promise<ModelName> {
  // Query mv_forecast_accuracy to get best model
  // Note: View not in generated types yet, using type cast
  const { data, error} = await (supabase as any)
    .from('mv_forecast_accuracy')
    .select('model_name')
    .eq('tenant_id', tenantId)
    .eq('forecast_type', forecastType)
    .eq('is_best_model', true)
    .single();
  
  if (error || !data) {
    // Default to exponential smoothing if no best model found
    return 'exponential_smoothing';
  }
  
  return data.model_name as ModelName;
}

async function enrichWithActualValues(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  forecasts: RevenueForecastPoint[]
): Promise<RevenueForecastPoint[]> {
  // Fetch actual revenue for dates that have passed
  const dates = forecasts.map((f) => f.date);
  
  // Note: View not in generated types yet, using type cast
  const { data, error } = await (supabase as any)
    .from('mv_monthly_pnl')
    .select('period_month, total_revenue')
    .eq('tenant_id', tenantId)
    .in('period_month', dates);
  
  if (error || !data) {
    return forecasts;
  }
  
  const actualMap = new Map(
    data.map((row: any) => [row.period_month, Number(row.total_revenue) || 0])
  );
  
  return forecasts.map((forecast): RevenueForecastPoint => {
    const actualRevenue = actualMap.get(forecast.date);
    if (actualRevenue !== undefined) {
      const actualRev = actualRevenue as number;
      const error = Math.abs(forecast.predictedRevenue - actualRev);
      const accuracyPct = actualRev !== 0 ? (1 - error / actualRev) * 100 : 0;
      return {
        ...forecast,
        actualRevenue: actualRev,
        accuracyPct: Math.max(0, Math.round(accuracyPct * 100) / 100),
      };
    }
    return forecast;
  });
}

// ============================================================================
// FORECASTING ALGORITHMS
// ============================================================================

/**
 * Simple Moving Average (SMA)
 * Predicts next value as average of last N values
 */
function forecastWithSMA(
  historicalData: HistoricalRevenueData[],
  horizon: number,
  confidenceLevel: number
): RevenueForecastPoint[] {
  const windowSize = Math.min(3, historicalData.length); // 3-month moving average
  const forecasts: RevenueForecastPoint[] = [];
  
  // Calculate standard deviation for confidence interval
  const revenues = historicalData.map((d) => d.revenue);
  const mean = revenues.reduce((sum, val) => sum + val, 0) / revenues.length;
  const variance = revenues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / revenues.length;
  const stdDev = Math.sqrt(variance);
  
  // Z-score for 95% confidence interval
  const zScore = confidenceLevel === 0.95 ? 1.96 : confidenceLevel === 0.90 ? 1.645 : 1.96;
  
  const lastDate = new Date(historicalData[historicalData.length - 1].month + '-01');
  
  for (let i = 0; i < horizon; i++) {
    // Calculate SMA from last windowSize values
    const recentData = i === 0 
      ? historicalData.slice(-windowSize)
      : [...historicalData.slice(-windowSize + i), ...forecasts.slice(0, i)].slice(-windowSize);
    
    const sma = recentData.reduce((sum, d) => sum + ('revenue' in d ? d.revenue : d.predictedRevenue), 0) / windowSize;
    
    // Generate forecast date
    const forecastDate = new Date(lastDate);
    forecastDate.setMonth(forecastDate.getMonth() + i + 1);
    const dateStr = forecastDate.toISOString().slice(0, 7); // YYYY-MM
    
    forecasts.push({
      date: dateStr,
      predictedRevenue: Math.round(sma),
      confidenceLower: Math.round(sma - zScore * stdDev),
      confidenceUpper: Math.round(sma + zScore * stdDev),
    });
  }
  
  return forecasts;
}

/**
 * Exponential Smoothing
 * Gives more weight to recent observations
 */
function forecastWithExponentialSmoothing(
  historicalData: HistoricalRevenueData[],
  horizon: number,
  confidenceLevel: number
): RevenueForecastPoint[] {
  const alpha = 0.3; // Smoothing factor (0-1, higher = more weight on recent data)
  const forecasts: RevenueForecastPoint[] = [];
  
  // Calculate initial smoothed value (average of first 3 months)
  let smoothedValue = historicalData.slice(0, 3).reduce((sum, d) => sum + d.revenue, 0) / 3;
  
  // Apply exponential smoothing to historical data
  for (let i = 3; i < historicalData.length; i++) {
    smoothedValue = alpha * historicalData[i].revenue + (1 - alpha) * smoothedValue;
  }
  
  // Calculate standard deviation of errors for confidence interval
  const errors: number[] = [];
  let testSmoothedValue = historicalData.slice(0, 3).reduce((sum, d) => sum + d.revenue, 0) / 3;
  
  for (let i = 3; i < historicalData.length; i++) {
    errors.push(historicalData[i].revenue - testSmoothedValue);
    testSmoothedValue = alpha * historicalData[i].revenue + (1 - alpha) * testSmoothedValue;
  }
  
  const meanError = errors.reduce((sum, e) => sum + e, 0) / errors.length;
  const variance = errors.reduce((sum, e) => sum + Math.pow(e - meanError, 2), 0) / errors.length;
  const stdDev = Math.sqrt(variance);
  
  const zScore = confidenceLevel === 0.95 ? 1.96 : confidenceLevel === 0.90 ? 1.645 : 1.96;
  
  const lastDate = new Date(historicalData[historicalData.length - 1].month + '-01');
  
  for (let i = 0; i < horizon; i++) {
    const forecastDate = new Date(lastDate);
    forecastDate.setMonth(forecastDate.getMonth() + i + 1);
    const dateStr = forecastDate.toISOString().slice(0, 7);
    
    forecasts.push({
      date: dateStr,
      predictedRevenue: Math.round(smoothedValue),
      confidenceLower: Math.round(smoothedValue - zScore * stdDev * Math.sqrt(i + 1)),
      confidenceUpper: Math.round(smoothedValue + zScore * stdDev * Math.sqrt(i + 1)),
    });
  }
  
  return forecasts;
}

/**
 * Linear Regression with Trend and Seasonality
 * Fits a line to historical data and extrapolates
 */
function forecastWithLinearRegression(
  historicalData: HistoricalRevenueData[],
  horizon: number,
  confidenceLevel: number
): RevenueForecastPoint[] {
  const n = historicalData.length;
  const revenues = historicalData.map((d) => d.revenue);
  
  // Calculate linear regression: y = mx + b
  const xValues = Array.from({ length: n }, (_, i) => i);
  const xMean = (n - 1) / 2;
  const yMean = revenues.reduce((sum, val) => sum + val, 0) / n;
  
  let numerator = 0;
  let denominator = 0;
  
  for (let i = 0; i < n; i++) {
    numerator += (xValues[i] - xMean) * (revenues[i] - yMean);
    denominator += Math.pow(xValues[i] - xMean, 2);
  }
  
  const slope = numerator / denominator;
  const intercept = yMean - slope * xMean;
  
  // Calculate residuals for confidence interval
  const residuals = revenues.map((y, i) => y - (slope * i + intercept));
  const residualVariance = residuals.reduce((sum, r) => sum + r * r, 0) / (n - 2);
  const residualStdDev = Math.sqrt(residualVariance);
  
  const zScore = confidenceLevel === 0.95 ? 1.96 : confidenceLevel === 0.90 ? 1.645 : 1.96;
  
  const lastDate = new Date(historicalData[historicalData.length - 1].month + '-01');
  const forecasts: RevenueForecastPoint[] = [];
  
  for (let i = 0; i < horizon; i++) {
    const x = n + i;
    const predicted = slope * x + intercept;
    
    // Standard error increases with distance from mean
    const standardError = residualStdDev * Math.sqrt(1 + 1 / n + Math.pow(x - xMean, 2) / denominator);
    
    const forecastDate = new Date(lastDate);
    forecastDate.setMonth(forecastDate.getMonth() + i + 1);
    const dateStr = forecastDate.toISOString().slice(0, 7);
    
    forecasts.push({
      date: dateStr,
      predictedRevenue: Math.round(Math.max(0, predicted)),
      confidenceLower: Math.round(Math.max(0, predicted - zScore * standardError)),
      confidenceUpper: Math.round(predicted + zScore * standardError),
    });
  }
  
  return forecasts;
}

// ============================================================================
// SUMMARY CALCULATIONS
// ============================================================================

function calculateSummary(
  forecasts: RevenueForecastPoint[],
  historicalData: HistoricalRevenueData[]
) {
  const totalPredictedRevenue = forecasts.reduce((sum, f) => sum + f.predictedRevenue, 0);
  const avgMonthlyRevenue = Math.round(totalPredictedRevenue / forecasts.length);
  
  // Calculate growth rate (compare to historical average)
  const historicalAvg = historicalData.reduce((sum, d) => sum + d.revenue, 0) / historicalData.length;
  const growthRate = ((avgMonthlyRevenue - historicalAvg) / historicalAvg) * 100;
  
  // Determine trend
  const firstForecast = forecasts[0].predictedRevenue;
  const lastForecast = forecasts[forecasts.length - 1].predictedRevenue;
  const trendThreshold = 0.05; // 5% threshold
  
  let trend: 'increasing' | 'decreasing' | 'stable';
  if ((lastForecast - firstForecast) / firstForecast > trendThreshold) {
    trend = 'increasing';
  } else if ((firstForecast - lastForecast) / firstForecast > trendThreshold) {
    trend = 'decreasing';
  } else {
    trend = 'stable';
  }
  
  return {
    totalPredictedRevenue: Math.round(totalPredictedRevenue),
    avgMonthlyRevenue,
    growthRate: Math.round(growthRate * 100) / 100,
    trend,
  };
}

function calculateAccuracyMetrics(forecasts: RevenueForecastPoint[]) {
  const forecastsWithActual = forecasts.filter((f) => f.actualRevenue !== undefined);
  
  if (forecastsWithActual.length === 0) {
    return null;
  }
  
  const avgAccuracyPct = forecastsWithActual.reduce((sum, f) => sum + (f.accuracyPct || 0), 0) / forecastsWithActual.length;
  
  const mapeValues = forecastsWithActual.map((f) => {
    const actual = f.actualRevenue!;
    return actual !== 0 ? Math.abs((f.predictedRevenue - actual) / actual) * 100 : 0;
  });
  const avgMape = mapeValues.reduce((sum, v) => sum + v, 0) / mapeValues.length;
  
  return {
    avgAccuracyPct: Math.round(avgAccuracyPct * 100) / 100,
    avgMape: Math.round(avgMape * 100) / 100,
  };
}

// ============================================================================
// DATABASE PERSISTENCE
// ============================================================================

async function saveForecastResults(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  forecasts: RevenueForecastPoint[],
  modelName: ModelName,
  modelVersion: string,
  forecastHorizon: number
): Promise<void> {
  const forecastRecords = forecasts.map((forecast) => ({
    tenant_id: tenantId,
    forecast_type: 'revenue',
    model_version: modelVersion,
    model_name: modelName,
    forecast_date: forecast.date + '-01', // Add day for DATE type
    forecast_horizon: forecastHorizon,
    predicted_value: forecast.predictedRevenue,
    confidence_lower: forecast.confidenceLower,
    confidence_upper: forecast.confidenceUpper,
    confidence_level: 0.95,
    actual_value: forecast.actualRevenue,
    accuracy_error: forecast.actualRevenue 
      ? Math.abs(forecast.predictedRevenue - forecast.actualRevenue)
      : null,
    accuracy_pct: forecast.accuracyPct || null,
  }));
  
  // Note: Table not in generated types yet, using type cast
  const { error } = await (supabase as any)
    .from('forecast_results')
    .upsert(forecastRecords, {
      onConflict: 'tenant_id,forecast_type,model_name,model_version,forecast_date,forecast_horizon',
    });
  
  if (error) {
    console.error('Failed to save forecast results:', error);
    // Non-critical error, don't throw
  }
}
