/**
 * Forecast Intelligence Types
 * Phase 7: Forecast Intelligence & Recommendation Engine
 */

// ============================================================================
// ENUMS
// ============================================================================

export type ForecastType = 'revenue' | 'churn' | 'demand';

export type ForecastHorizon = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 30 | 60 | 90;

export type ModelName = 
  | 'simple_moving_average' 
  | 'exponential_smoothing' 
  | 'linear_regression'
  | 'arima'
  | 'prophet'
  | 'logistic_regression'
  | 'random_forest';

// ============================================================================
// FORECAST RESULTS
// ============================================================================

export interface ForecastResult {
  id: string;
  tenantId: string;
  forecastType: ForecastType;
  modelVersion: string;
  modelName: ModelName;
  forecastDate: string; // ISO date
  forecastHorizon: ForecastHorizon;
  predictedValue: number;
  confidenceLower: number;
  confidenceUpper: number;
  confidenceLevel: number;
  actualValue?: number;
  accuracyError?: number;
  accuracyPct?: number;
  features?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: string;
  createdBy?: string;
  updatedAt?: string;
}

export interface ForecastInput {
  tenantId: string;
  forecastType: ForecastType;
  forecastHorizon: ForecastHorizon;
  modelName?: ModelName; // If not provided, use best model
  confidenceLevel?: number; // Default: 0.95
  startDate?: string; // Start date for forecast
  endDate?: string; // End date for forecast
}

// ============================================================================
// FORECAST ACCURACY
// ============================================================================

export interface ForecastAccuracySummary {
  tenantId: string;
  forecastType: ForecastType;
  modelName: ModelName;
  modelVersion: string;
  forecastHorizon: ForecastHorizon;
  totalForecasts: number;
  forecastsWithinCi: number;
  avgAccuracyPct: number;
  medianAccuracyPct: number;
  minAccuracyPct: number;
  maxAccuracyPct: number;
  avgError: number;
  avgMape: number;
  medianError: number;
  stddevError: number;
  ciCoveragePct: number;
  avgBias: number;
  avgBiasPct: number;
  recentAccuracyPct: number | null;
  recentError: number | null;
  earliestForecastDate: string;
  latestForecastDate: string;
  lastUpdated: string;
  accuracyRank: number;
  isBestModel: boolean;
}

export interface ModelComparisonResult {
  modelName: ModelName;
  modelVersion: string;
  avgAccuracyPct: number;
  avgMape: number;
  ciCoveragePct: number;
  totalForecasts: number;
  recentAccuracyPct: number | null;
  accuracyRank: number;
}

// ============================================================================
// REVENUE FORECAST
// ============================================================================

export interface RevenueForecastPoint {
  date: string; // YYYY-MM
  predictedRevenue: number;
  confidenceLower: number;
  confidenceUpper: number;
  actualRevenue?: number;
  accuracyPct?: number;
}

export interface RevenueForecastResult {
  tenantId: string;
  modelName: ModelName;
  modelVersion: string;
  confidenceLevel: number;
  horizon: ForecastHorizon;
  forecasts: RevenueForecastPoint[];
  summary: {
    totalPredictedRevenue: number;
    avgMonthlyRevenue: number;
    growthRate: number; // Percentage
    trend: 'increasing' | 'decreasing' | 'stable';
  };
  accuracy?: {
    avgAccuracyPct: number;
    avgMape: number;
  };
}

// ============================================================================
// CHURN FORECAST
// ============================================================================

export interface ChurnForecastResult {
  tenantId: string;
  modelName: ModelName;
  modelVersion: string;
  horizon: 30 | 60 | 90; // Days
  customersAtRisk: CustomerChurnPrediction[];
  summary: {
    totalCustomers: number;
    predictedChurn: number;
    churnRate: number; // Percentage
    expectedRevenueLoss: number;
    avgChurnProbability: number;
  };
  accuracy?: {
    avgAccuracyPct: number;
    precision: number;
    recall: number;
    f1Score: number;
  };
}

export interface CustomerChurnPrediction {
  customerId: string;
  customerName: string;
  churnProbability: number; // 0-1
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  expectedRevenueLoss: number;
  lastPurchaseDate: string;
  daysSinceLastPurchase: number;
  lifetimeValue: number;
  factors: ChurnRiskFactors;
  recommendations: string[];
}

export interface ChurnRiskFactors {
  recencyScore: number; // 0-1
  frequencyScore: number; // 0-1
  monetaryScore: number; // 0-1
  satisfactionScore: number; // 0-1
  engagementScore: number; // 0-1
}

// ============================================================================
// DEMAND FORECAST
// ============================================================================

export interface DemandForecastResult {
  tenantId: string;
  modelName: ModelName;
  modelVersion: string;
  horizon: ForecastHorizon;
  itemType: 'service' | 'package';
  forecasts: ItemDemandForecast[];
  summary: {
    totalPredictedDemand: number;
    avgDailyDemand: number;
    peakDemandDate: string;
    peakDemandValue: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  };
  accuracy?: {
    avgAccuracyPct: number;
    avgMape: number;
  };
}

export interface ItemDemandForecast {
  itemId: string;
  itemName: string;
  itemType: 'service' | 'package';
  date: string; // YYYY-MM-DD
  predictedDemand: number;
  confidenceLower: number;
  confidenceUpper: number;
  actualDemand?: number;
  accuracyPct?: number;
  seasonalityFactor?: number;
  trendFactor?: number;
}

// ============================================================================
// MODEL TRAINING
// ============================================================================

export interface ModelTrainingInput {
  tenantId: string;
  forecastType: ForecastType;
  modelName: ModelName;
  trainingStartDate: string;
  trainingEndDate: string;
  validationSplit: number; // 0.1 - 0.3
  hyperparameters?: Record<string, unknown>;
}

export interface ModelTrainingResult {
  modelName: ModelName;
  modelVersion: string;
  trainingMetrics: {
    trainingAccuracy: number;
    validationAccuracy: number;
    trainingMape: number;
    validationMape: number;
    overfit: boolean;
  };
  hyperparameters: Record<string, unknown>;
  featureImportance?: Array<{
    featureName: string;
    importance: number;
  }>;
  trainingDuration: number; // seconds
  createdAt: string;
}

// ============================================================================
// TIME SERIES DATA
// ============================================================================

export interface TimeSeriesDataPoint {
  date: string;
  value: number;
  features?: Record<string, number>;
}

export interface TimeSeriesData {
  tenantId: string;
  metric: string;
  startDate: string;
  endDate: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  dataPoints: TimeSeriesDataPoint[];
}

// ============================================================================
// API RESPONSES
// ============================================================================

export interface ForecastResponse<T> {
  success: boolean;
  data: T;
  meta: {
    generatedAt: string;
    modelName: ModelName;
    modelVersion: string;
    confidenceLevel: number;
    dataSource: 'cache' | 'computation';
    computationTime?: number; // ms
  };
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface BulkForecastResponse {
  success: boolean;
  data: {
    revenue: RevenueForecastResult;
    churn: ChurnForecastResult;
    demand: DemandForecastResult;
  };
  meta: {
    generatedAt: string;
    totalComputationTime: number; // ms
  };
}
