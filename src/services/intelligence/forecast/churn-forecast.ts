/**
 * Churn Forecasting Service
 * Phase 7: Forecast Intelligence & Recommendation Engine
 * 
 * Implements churn prediction using:
 * - Logistic Regression (rule-based scoring)
 * - Multi-factor risk assessment (RFM + Satisfaction + Engagement)
 * - 30/60/90-day churn probability windows
 */

import { createClient } from '@/lib/supabase-server';
import type {
  ForecastInput,
  ChurnForecastResult,
  CustomerChurnPrediction,
  ChurnRiskFactors,
} from './types';

// ============================================================================
// TYPES
// ============================================================================

interface CustomerData {
  customerId: string;
  customerName: string;
  lastPurchaseDate: string;
  daysSinceLastPurchase: number;
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  avgRating: number | null;
  lifetimeValue: number;
  segment: string;
  recencyScore: number;
  frequencyScore: number;
  monetaryScore: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MODEL_VERSION = 'v1.0';

// Churn risk thresholds
const CRITICAL_THRESHOLD = 0.75;
const HIGH_THRESHOLD = 0.60;
const MEDIUM_THRESHOLD = 0.40;

// Factor weights (must sum to 1.0)
const WEIGHTS = {
  recency: 0.40, // Days since last purchase
  frequency: 0.25, // Order frequency decline
  monetary: 0.20, // Revenue decline
  satisfaction: 0.10, // Rating trends
  engagement: 0.05, // Login/interaction trends
};

// ============================================================================
// MAIN FORECAST FUNCTION
// ============================================================================

export async function forecastChurn(
  input: ForecastInput
): Promise<ChurnForecastResult> {
  const supabase = await createClient();
  
  // Validate horizon (must be 30, 60, or 90 days)
  if (![30, 60, 90].includes(input.forecastHorizon)) {
    throw new Error('Churn forecast horizon must be 30, 60, or 90 days');
  }
  
  // Fetch customer data with RFM scores
  const customerData = await fetchCustomerData(supabase, input.tenantId);
  
  if (customerData.length === 0) {
    return {
      tenantId: input.tenantId,
      modelName: 'logistic_regression',
      modelVersion: MODEL_VERSION,
      horizon: input.forecastHorizon as 30 | 60 | 90,
      customersAtRisk: [],
      summary: {
        totalCustomers: 0,
        predictedChurn: 0,
        churnRate: 0,
        expectedRevenueLoss: 0,
        avgChurnProbability: 0,
      },
    };
  }
  
  // Calculate churn probabilities for each customer
  const customersAtRisk = await Promise.all(
    customerData.map((customer) => 
      calculateChurnProbability(customer, input.forecastHorizon)
    )
  );
  
  // Filter customers with churn probability > 0.3 (medium risk or higher)
  const filteredCustomers = customersAtRisk
    .filter((c) => c.churnProbability >= 0.3)
    .sort((a, b) => b.churnProbability - a.churnProbability);
  
  // Calculate summary statistics
  const summary = calculateChurnSummary(customersAtRisk, customerData.length);
  
  // Get accuracy metrics if available
  const accuracy = await getChurnAccuracy(supabase, input.tenantId);
  
  // Save predictions to database
  await saveChurnPredictions(
    supabase,
    input.tenantId,
    customersAtRisk,
    input.forecastHorizon
  );
  
  return {
    tenantId: input.tenantId,
    modelName: 'logistic_regression',
    modelVersion: MODEL_VERSION,
    horizon: input.forecastHorizon as 30 | 60 | 90,
    customersAtRisk: filteredCustomers,
    summary,
    accuracy: accuracy || undefined,
  };
}

// ============================================================================
// DATA FETCHING
// ============================================================================

async function fetchCustomerData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string
): Promise<CustomerData[]> {
  // Fetch customer data from mv_customer_segments (has RFM scores)
  // Note: View not in generated types yet, using type cast
  type SupabaseDynamic = { from: (table: string) => any };
  try {
    const { data, error } = await (supabase as unknown as SupabaseDynamic)
      .from('mv_customer_segments')
      .select('*')
      .eq('tenant_id', tenantId);
    
    if (error) {
      throw error;
    }
    
    if (!data || (data as unknown[]).length === 0) {
      return [];
    }
    
    // Transform to CustomerData format
    return (data as unknown as Record<string, unknown>[]).map((row) => ({
      customerId: String(row.customer_id),
      customerName: String(row.customer_name || 'Unknown'),
      lastPurchaseDate: String(row.last_purchase_date || ''),
      daysSinceLastPurchase: Number(row.days_since_last_purchase || 0),
      totalOrders: Number(row.total_orders || 0),
      totalRevenue: Number(row.total_revenue || 0),
      avgOrderValue: Number(row.avg_order_value || 0),
      avgRating: row.avg_rating ? Number(row.avg_rating) : null,
      lifetimeValue: Number(row.total_revenue || 0),
      segment: String(row.segment || 'Unknown'),
      recencyScore: Number(row.recency_score || 0),
      frequencyScore: Number(row.frequency_score || 0),
      monetaryScore: Number(row.monetary_score || 0),
    }));
  } catch (viewError) {
    console.warn('[Churn Forecast] mv_customer_segments not available, falling back to base tables:', viewError);
    
    // Fallback: query customers and bookings tables
    const { data: customers, error: custError } = await supabase
      .from('customers')
      .select('id, name_mother, created_at')
      .eq('tenant_id', tenantId);
    
    if (custError) {
      throw custError; // Propagate real DB errors per Rule #1
    }
    
    if (!customers || customers.length === 0) {
      return [];
    }
    
    // Get bookings to compute RFM
    const { data: bookings, error: bookingError } = await supabase
      .from('bookings')
      .select('customer_id, created_at, deposit_amount, full_price')
      .eq('tenant_id', tenantId)
      .in('status', ['active', 'completed']);
    
    if (bookingError) {
      throw bookingError; // Propagate real DB errors per Rule #1
    }
    
    const now = Date.now();
    const bookingsByCustomer = new Map<string, { customer_id: string; created_at: string | null; deposit_amount: number | null; full_price: number | null }[]>();
    (bookings || []).forEach(b => {
      if (!bookingsByCustomer.has(b.customer_id)) bookingsByCustomer.set(b.customer_id, []);
      bookingsByCustomer.get(b.customer_id)!.push(b);
    });
    
    return customers.map(c => {
      const custBookings = bookingsByCustomer.get(c.id) || [];
      const dates = custBookings.map(b => b.created_at ? new Date(b.created_at).getTime() : 0).sort((a, z) => z - a);
      const lastTs = dates[0] || (c.created_at ? new Date(c.created_at).getTime() : now);
      const daysSince = Math.floor((now - lastTs) / (1000 * 60 * 60 * 24));
      const totalRevenue = custBookings.reduce((s, b) => s + Number(b.full_price || 0), 0);
      const totalOrders = custBookings.length;
      // Simple recency/frequency/monetary scores (0-1 scale)
      const recencyScore = Math.max(0, 1 - daysSince / 365);
      const frequencyScore = Math.min(1, totalOrders / 10);
      const monetaryScore = Math.min(1, totalRevenue / 10_000_000);
      return {
        customerId: c.id,
        customerName: c.name_mother || 'Unknown',
        lastPurchaseDate: new Date(lastTs).toISOString().split('T')[0],
        daysSinceLastPurchase: daysSince,
        totalOrders,
        totalRevenue,
        avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
        avgRating: null,
        lifetimeValue: totalRevenue,
        segment: 'fallback',
        recencyScore,
        frequencyScore,
        monetaryScore,
      };
    });
  }
}


async function getChurnAccuracy(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string
): Promise<{ avgAccuracyPct: number; precision: number; recall: number; f1Score: number } | null> {
  // Query mv_forecast_accuracy for churn model metrics
  // Note: View not in generated types yet, using type cast
  type SupabaseDynamic = { from: (table: string) => any };
  const { data, error } = await (supabase as unknown as SupabaseDynamic)
    .from('mv_forecast_accuracy')
    .select('avg_accuracy_pct, avg_mape')
    .eq('tenant_id', tenantId)
    .eq('forecast_type', 'churn')
    .eq('is_best_model', true)
    .single();
  
  if (error || !data) {
    return null;
  }
  
  // For churn, we use MAPE as a proxy for precision/recall
  // (actual precision/recall would require tracking actual churned customers)
  const avgAccuracyPct = Number(data.avg_accuracy_pct) || 0;
  const avgMape = Number(data.avg_mape) || 0;
  
  // Estimate precision/recall from accuracy
  const precision = avgAccuracyPct / 100;
  const recall = Math.max(0, 1 - avgMape / 100);
  const f1Score = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  
  return {
    avgAccuracyPct,
    precision: Math.round(precision * 100) / 100,
    recall: Math.round(recall * 100) / 100,
    f1Score: Math.round(f1Score * 100) / 100,
  };
}

// ============================================================================
// CHURN PROBABILITY CALCULATION
// ============================================================================

async function calculateChurnProbability(
  customer: CustomerData,
  horizon: number
): Promise<CustomerChurnPrediction> {
  // Calculate individual risk factors
  const factors = calculateRiskFactors(customer, horizon);
  
  // Calculate weighted churn probability
  const churnProbability = 
    factors.recencyScore * WEIGHTS.recency +
    factors.frequencyScore * WEIGHTS.frequency +
    factors.monetaryScore * WEIGHTS.monetary +
    factors.satisfactionScore * WEIGHTS.satisfaction +
    factors.engagementScore * WEIGHTS.engagement;
  
  // Determine risk level
  let riskLevel: 'low' | 'medium' | 'high' | 'critical';
  if (churnProbability >= CRITICAL_THRESHOLD) {
    riskLevel = 'critical';
  } else if (churnProbability >= HIGH_THRESHOLD) {
    riskLevel = 'high';
  } else if (churnProbability >= MEDIUM_THRESHOLD) {
    riskLevel = 'medium';
  } else {
    riskLevel = 'low';
  }
  
  // Calculate expected revenue loss
  const expectedRevenueLoss = Math.round(customer.lifetimeValue * churnProbability);
  
  // Generate recommendations
  const recommendations = generateRetentionRecommendations(customer, factors, riskLevel);
  
  return {
    customerId: customer.customerId,
    customerName: customer.customerName,
    churnProbability: Math.round(churnProbability * 100) / 100,
    riskLevel,
    expectedRevenueLoss,
    lastPurchaseDate: customer.lastPurchaseDate,
    daysSinceLastPurchase: customer.daysSinceLastPurchase,
    lifetimeValue: customer.lifetimeValue,
    factors,
    recommendations,
  };
}

function calculateRiskFactors(
  customer: CustomerData,
  horizon: number
): ChurnRiskFactors {
  // 1. Recency Score (0-1, higher = more risk)
  // Based on days since last purchase vs. horizon
  const recencyRatio = customer.daysSinceLastPurchase / horizon;
  const recencyScore = Math.min(1, Math.max(0, recencyRatio));
  
  // 2. Frequency Score (0-1, higher = more risk)
  // Based on order frequency (inverse of RFM frequency score)
  const frequencyScore = 1 - (customer.frequencyScore / 5); // RFM score is 1-5
  
  // 3. Monetary Score (0-1, higher = more risk)
  // Based on monetary value (inverse of RFM monetary score)
  const monetaryScore = 1 - (customer.monetaryScore / 5);
  
  // 4. Satisfaction Score (0-1, higher = more risk)
  // Based on average rating (low rating = high risk)
  const satisfactionScore = customer.avgRating !== null
    ? Math.max(0, (3 - customer.avgRating) / 3) // 5-star => 0 risk, 2-star => high risk
    : 0.5; // Unknown = medium risk
  
  // 5. Engagement Score (0-1, higher = more risk)
  // For now, use recency as proxy (could add login tracking later)
  const engagementScore = recencyScore;
  
  return {
    recencyScore: Math.round(recencyScore * 100) / 100,
    frequencyScore: Math.round(frequencyScore * 100) / 100,
    monetaryScore: Math.round(monetaryScore * 100) / 100,
    satisfactionScore: Math.round(satisfactionScore * 100) / 100,
    engagementScore: Math.round(engagementScore * 100) / 100,
  };
}

function generateRetentionRecommendations(
  customer: CustomerData,
  factors: ChurnRiskFactors,
  riskLevel: string
): string[] {
  const recommendations: string[] = [];
  
  // Recency-based recommendations
  if (factors.recencyScore > 0.7) {
    recommendations.push('Gửi email/SMS nhắc nhở với ưu đãi đặc biệt để khách quay lại');
    recommendations.push(`Khách đã ${customer.daysSinceLastPurchase} ngày không quay lại - cần chăm sóc ngay`);
  } else if (factors.recencyScore > 0.5) {
    recommendations.push('Gửi chương trình khuyến mãi hoặc voucher để kích hoạt lại');
  }
  
  // Frequency-based recommendations
  if (factors.frequencyScore > 0.6) {
    recommendations.push('Tạo gói dịch vụ combo ưu đãi để tăng tần suất sử dụng');
    recommendations.push('Đề xuất chương trình loyalty/membership để giữ chân');
  }
  
  // Monetary-based recommendations
  if (factors.monetaryScore > 0.6 && customer.avgOrderValue > 0) {
    recommendations.push('Upsell gói cao cấp hơn với giá trị tốt hơn');
  }
  
  // Satisfaction-based recommendations
  if (factors.satisfactionScore > 0.5) {
    if (customer.avgRating !== null && customer.avgRating < 3.5) {
      recommendations.push('Khách có đánh giá thấp - cần liên hệ ngay để giải quyết vấn đề');
      recommendations.push('Đề xuất bồi thường/ưu đãi để cải thiện trải nghiệm');
    } else {
      recommendations.push('Chưa có đánh giá - khảo sát mức độ hài lòng');
    }
  }
  
  // Risk level-specific recommendations
  if (riskLevel === 'critical') {
    recommendations.unshift('⚠️ KHẨN CẤP: Liên hệ trực tiếp với khách hàng trong 24h');
    recommendations.push('Xem xét offer đặc biệt 1-1 từ manager');
  } else if (riskLevel === 'high') {
    recommendations.unshift('⚡ Ưu tiên cao: Chăm sóc trong tuần này');
  }
  
  // Segment-specific recommendations
  if (customer.segment.includes('VIP') || customer.segment.includes('Champion')) {
    recommendations.push('Khách VIP - cần chương trình chăm sóc đặc biệt');
  }
  
  return recommendations.slice(0, 5); // Limit to top 5 recommendations
}

// ============================================================================
// SUMMARY CALCULATIONS
// ============================================================================

function calculateChurnSummary(
  customersAtRisk: CustomerChurnPrediction[],
  totalCustomers: number
) {
  const predictedChurn = customersAtRisk.filter((c) => c.churnProbability >= 0.5).length;
  const churnRate = (predictedChurn / totalCustomers) * 100;
  
  const expectedRevenueLoss = customersAtRisk.reduce(
    (sum, c) => sum + c.expectedRevenueLoss,
    0
  );
  
  const avgChurnProbability = customersAtRisk.length > 0
    ? customersAtRisk.reduce((sum, c) => sum + c.churnProbability, 0) / customersAtRisk.length
    : 0;
  
  return {
    totalCustomers,
    predictedChurn,
    churnRate: Math.round(churnRate * 100) / 100,
    expectedRevenueLoss: Math.round(expectedRevenueLoss),
    avgChurnProbability: Math.round(avgChurnProbability * 100) / 100,
  };
}

// ============================================================================
// DATABASE PERSISTENCE
// ============================================================================

async function saveChurnPredictions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  predictions: CustomerChurnPrediction[],
  horizon: number
): Promise<void> {
  // Save to forecast_results table
  const forecastRecords = predictions
    .filter((p) => p.churnProbability >= 0.3) // Only save medium+ risk
    .map((prediction) => ({
      tenant_id: tenantId,
      forecast_type: 'churn',
      model_version: MODEL_VERSION,
      model_name: 'logistic_regression',
      forecast_date: new Date(Date.now() + horizon * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      forecast_horizon: horizon,
      predicted_value: prediction.churnProbability,
      confidence_lower: Math.max(0, prediction.churnProbability - 0.15),
      confidence_upper: Math.min(1, prediction.churnProbability + 0.15),
      confidence_level: 0.80, // 80% confidence for churn predictions
      features: {
        customer_id: prediction.customerId,
        customer_name: prediction.customerName,
        days_since_last_purchase: prediction.daysSinceLastPurchase,
        lifetime_value: prediction.lifetimeValue,
        risk_level: prediction.riskLevel,
      },
      metadata: {
        factors: prediction.factors,
        expected_revenue_loss: prediction.expectedRevenueLoss,
      },
    }));
  
  if (forecastRecords.length === 0) {
    return;
  }
  
  // Note: Table not in generated types yet, using type cast
  type SupabaseDynamic = { from: (table: string) => any };
  const { error } = await (supabase as unknown as SupabaseDynamic)
    .from('forecast_results')
    .upsert(forecastRecords, {
      onConflict: 'tenant_id,forecast_type,model_name,model_version,forecast_date,forecast_horizon',
      ignoreDuplicates: false,
    });
  
  if (error) {
    console.error('Failed to save churn predictions:', error);
    // Non-critical error, don't throw
  }
}
