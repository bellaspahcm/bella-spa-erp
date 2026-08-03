/**
 * Bella Auto Phase 9 - Churn Prediction Service
 * 
 * Predicts which service customers are likely to churn (stop using service center).
 * Foundation layer - actual ML models to be integrated later.
 * 
 * Features:
 * - Churn risk scoring
 * - Retention strategy recommendations
 * - Customer segmentation by risk
 * - Action tracking
 * 
 * @module bella-auto/services/ChurnPredictionService
 */

import { getPrimaryClient } from '@/lib/database/read-replica';
import { Database } from '@/types/database.types';

type ChurnPrediction = Database['public']['Tables']['auto_churn_predictions']['Row'];
type ChurnPredictionInsert = Database['public']['Tables']['auto_churn_predictions']['Insert'];

type ChurnRiskLevel = 'low' | 'medium' | 'high' | 'critical';
type ActionResult = 'retained' | 'churned' | 'pending';
type PredictionStatus = 'active' | 'actioned' | 'expired';

interface CreatePredictionParams {
  tenantId: string;
  customerId: string;
  vehicleId: string;
  churnProbability: number;
  churnRiskLevel: ChurnRiskLevel;
  estimatedDaysToChurn?: number;
  factors: any[];
  primaryReason?: string;
  daysSinceLastService?: number;
  totalServiceVisits?: number;
  averageVisitFrequencyDays?: number;
  totalLifetimeValue?: number;
  averageRepairCost?: number;
  npsScore?: number;
  csiScore?: number;
  recommendedActions?: any[];
  retentionStrategy?: string;
  estimatedRetentionCost?: number;
  modelName?: string;
  modelVersion?: string;
  modelConfidence?: number;
}

export class ChurnPredictionService {
  /**
   * Create new churn prediction
   */
  static async create(params: CreatePredictionParams): Promise<ChurnPrediction> {
    const supabase = getPrimaryClient();
    
    const predictionData: ChurnPredictionInsert = {
      tenant_id: params.tenantId,
      customer_id: params.customerId,
      vehicle_id: params.vehicleId,
      churn_probability: params.churnProbability,
      churn_risk_level: params.churnRiskLevel,
      estimated_days_to_churn: params.estimatedDaysToChurn,
      factors: params.factors as any,
      primary_reason: params.primaryReason,
      days_since_last_service: params.daysSinceLastService,
      total_service_visits: params.totalServiceVisits,
      average_visit_frequency_days: params.averageVisitFrequencyDays,
      total_lifetime_value: params.totalLifetimeValue,
      average_repair_cost: params.averageRepairCost,
      nps_score: params.npsScore,
      csi_score: params.csiScore,
      recommended_actions: params.recommendedActions as any,
      retention_strategy: params.retentionStrategy,
      estimated_retention_cost: params.estimatedRetentionCost,
      model_name: params.modelName || 'churn-prediction-v1',
      model_version: params.modelVersion,
      model_confidence: params.modelConfidence,
      status: 'active',
    };
    
    const { data, error } = await supabase
      .from('auto_churn_predictions')
      .insert(predictionData)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to create churn prediction: ${error.message}`);
    }
    
    return data;
  }
  
  /**
   * Get prediction by ID
   */
  static async getById(predictionId: string, tenantId: string): Promise<ChurnPrediction | null> {
    const supabase = getPrimaryClient();
    
    const { data, error } = await supabase
      .from('auto_churn_predictions')
      .select('*')
      .eq('id', predictionId)
      .eq('tenant_id', tenantId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch churn prediction: ${error.message}`);
    }
    
    return data;
  }
  
  /**
   * Get latest prediction for customer
   */
  static async getLatestForCustomer(
    customerId: string,
    tenantId: string
  ): Promise<ChurnPrediction | null> {
    const supabase = getPrimaryClient();
    
    const { data, error } = await supabase
      .from('auto_churn_predictions')
      .select('*')
      .eq('customer_id', customerId)
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .order('prediction_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (error) {
      throw new Error(`Failed to fetch customer prediction: ${error.message}`);
    }
    
    return data;
  }
  
  /**
   * Get high-risk customers
   */
  static async getHighRiskCustomers(tenantId: string): Promise<ChurnPrediction[]> {
    const supabase = getPrimaryClient();
    
    const { data, error } = await supabase
      .from('auto_churn_predictions')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .in('churn_risk_level', ['high', 'critical'])
      .order('churn_probability', { ascending: false });
    
    if (error) {
      throw new Error(`Failed to fetch high-risk customers: ${error.message}`);
    }
    
    return data || [];
  }
  
  /**
   * Get predictions by risk level
   */
  static async getByRiskLevel(
    riskLevel: ChurnRiskLevel,
    tenantId: string
  ): Promise<ChurnPrediction[]> {
    const supabase = getPrimaryClient();
    
    const { data, error } = await supabase
      .from('auto_churn_predictions')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('churn_risk_level', riskLevel)
      .eq('status', 'active')
      .order('prediction_date', { ascending: false });
    
    if (error) {
      throw new Error(`Failed to fetch predictions by risk level: ${error.message}`);
    }
    
    return data || [];
  }
  
  /**
   * Record retention action
   */
  static async recordAction(
    predictionId: string,
    tenantId: string,
    actionType: string,
    actionResult?: ActionResult
  ): Promise<ChurnPrediction> {
    const supabase = getPrimaryClient();
    
    const updates: any = {
      action_taken: true,
      action_date: new Date().toISOString().split('T')[0],
      action_type: actionType,
      status: 'actioned',
    };
    
    if (actionResult) {
      updates.action_result = actionResult;
    }
    
    const { data, error } = await supabase
      .from('auto_churn_predictions')
      .update(updates)
      .eq('id', predictionId)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to record action: ${error.message}`);
    }
    
    return data;
  }
  
  /**
   * Mark prediction as expired
   */
  static async markExpired(predictionId: string, tenantId: string): Promise<ChurnPrediction> {
    const supabase = getPrimaryClient();
    
    const { data, error } = await supabase
      .from('auto_churn_predictions')
      .update({ status: 'expired' })
      .eq('id', predictionId)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to mark prediction as expired: ${error.message}`);
    }
    
    return data;
  }
  
  /**
   * Simple churn risk calculation (rule-based, before ML)
   * Based on service frequency, recency, and satisfaction
   */
  static calculateSimpleChurnRisk(params: {
    daysSinceLastService: number;
    totalServiceVisits: number;
    averageVisitFrequencyDays: number;
    npsScore?: number;
    csiScore?: number;
    totalLifetimeValue: number;
  }): {
    churnProbability: number;
    churnRiskLevel: ChurnRiskLevel;
    estimatedDaysToChurn: number;
    factors: Array<{ factor: string; weight: number; description: string }>;
    primaryReason: string;
  } {
    const factors: Array<{ factor: string; weight: number; description: string }> = [];
    let riskScore = 0;
    
    // Factor 1: Recency (max 40 points)
    const expectedNextVisit = params.averageVisitFrequencyDays;
    const overdueRatio = params.daysSinceLastService / expectedNextVisit;
    
    let recencyScore = 0;
    if (overdueRatio > 2.0) {
      recencyScore = 40;
      factors.push({
        factor: 'service_overdue',
        weight: 0.4,
        description: `Over 2x overdue (${params.daysSinceLastService} days since last service)`,
      });
    } else if (overdueRatio > 1.5) {
      recencyScore = 30;
      factors.push({
        factor: 'service_delayed',
        weight: 0.3,
        description: `1.5x overdue (${params.daysSinceLastService} days since last service)`,
      });
    } else if (overdueRatio > 1.0) {
      recencyScore = 15;
      factors.push({
        factor: 'service_due',
        weight: 0.15,
        description: `Service due (${params.daysSinceLastService} days since last service)`,
      });
    }
    
    riskScore += recencyScore;
    
    // Factor 2: Low engagement (max 25 points)
    if (params.totalServiceVisits < 3) {
      riskScore += 25;
      factors.push({
        factor: 'low_engagement',
        weight: 0.25,
        description: `Only ${params.totalServiceVisits} service visits (low loyalty)`,
      });
    } else if (params.totalServiceVisits < 5) {
      riskScore += 15;
      factors.push({
        factor: 'moderate_engagement',
        weight: 0.15,
        description: `${params.totalServiceVisits} service visits (moderate loyalty)`,
      });
    }
    
    // Factor 3: Low satisfaction (max 20 points)
    if (params.npsScore !== undefined && params.npsScore < 7) {
      riskScore += 20;
      factors.push({
        factor: 'low_nps',
        weight: 0.2,
        description: `Low NPS score (${params.npsScore}/10)`,
      });
    } else if (params.npsScore !== undefined && params.npsScore < 9) {
      riskScore += 10;
      factors.push({
        factor: 'moderate_nps',
        weight: 0.1,
        description: `Moderate NPS score (${params.npsScore}/10)`,
      });
    }
    
    if (params.csiScore !== undefined && params.csiScore < 3.5) {
      riskScore += 15;
      factors.push({
        factor: 'low_csi',
        weight: 0.15,
        description: `Low CSI score (${params.csiScore}/5)`,
      });
    }
    
    // Calculate churn probability (0-1)
    const churnProbability = Math.min(1, riskScore / 100);
    
    // Determine risk level
    let churnRiskLevel: ChurnRiskLevel;
    if (churnProbability >= 0.75) churnRiskLevel = 'critical';
    else if (churnProbability >= 0.50) churnRiskLevel = 'high';
    else if (churnProbability >= 0.25) churnRiskLevel = 'medium';
    else churnRiskLevel = 'low';
    
    // Estimate days to churn
    const estimatedDaysToChurn = Math.max(
      7,
      Math.round(expectedNextVisit * (1 - churnProbability) + params.daysSinceLastService)
    );
    
    // Primary reason
    const sortedFactors = [...factors].sort((a, b) => b.weight - a.weight);
    const primaryReason = sortedFactors[0]?.description || 'Unknown';
    
    return {
      churnProbability: Math.round(churnProbability * 10000) / 10000,
      churnRiskLevel,
      estimatedDaysToChurn,
      factors,
      primaryReason,
    };
  }
  
  /**
   * Generate retention recommendations
   */
  static generateRetentionRecommendations(params: {
    churnRiskLevel: ChurnRiskLevel;
    factors: Array<{ factor: string; weight: number }>;
    totalLifetimeValue: number;
  }): {
    recommendedActions: Array<{ action: string; priority: string; description: string }>;
    retentionStrategy: string;
    estimatedRetentionCost: number;
  } {
    const actions: Array<{ action: string; priority: string; description: string }> = [];
    let retentionStrategy = '';
    let estimatedRetentionCost = 0;
    
    const hasOverdueService = params.factors.some(f => f.factor === 'service_overdue' || f.factor === 'service_delayed');
    const hasLowSatisfaction = params.factors.some(f => f.factor === 'low_nps' || f.factor === 'low_csi');
    const hasLowEngagement = params.factors.some(f => f.factor === 'low_engagement');
    
    if (params.churnRiskLevel === 'critical' || params.churnRiskLevel === 'high') {
      // High-touch retention for high-value customers
      if (params.totalLifetimeValue > 50000000) {
        actions.push({
          action: 'personal_call',
          priority: 'critical',
          description: 'Personal call from service manager within 24 hours',
        });
        actions.push({
          action: 'vip_discount',
          priority: 'high',
          description: 'Offer 20% VIP discount on next service',
        });
        estimatedRetentionCost = 5000000;
        retentionStrategy = 'High-touch VIP retention program';
      } else {
        actions.push({
          action: 'outreach_call',
          priority: 'high',
          description: 'Service advisor follow-up call within 48 hours',
        });
        actions.push({
          action: 'discount_offer',
          priority: 'medium',
          description: 'Offer 10% discount on next service',
        });
        estimatedRetentionCost = 2000000;
        retentionStrategy = 'Proactive outreach with incentive';
      }
    }
    
    if (hasOverdueService) {
      actions.push({
        action: 'reminder_sms',
        priority: 'high',
        description: 'Send service reminder SMS with booking link',
      });
      actions.push({
        action: 'flexible_scheduling',
        priority: 'medium',
        description: 'Offer flexible scheduling options (evening/weekend)',
      });
    }
    
    if (hasLowSatisfaction) {
      actions.push({
        action: 'satisfaction_survey',
        priority: 'high',
        description: 'Send satisfaction survey to understand issues',
      });
      actions.push({
        action: 'service_recovery',
        priority: 'critical',
        description: 'Investigate and resolve previous service complaints',
      });
    }
    
    if (hasLowEngagement) {
      actions.push({
        action: 'loyalty_program',
        priority: 'medium',
        description: 'Enroll in loyalty program with points/rewards',
      });
      actions.push({
        action: 'educational_content',
        priority: 'low',
        description: 'Send vehicle care tips and maintenance guides',
      });
    }
    
    if (!retentionStrategy) {
      retentionStrategy = params.churnRiskLevel === 'medium' 
        ? 'Standard retention program'
        : 'Monitoring with periodic outreach';
    }
    
    return {
      recommendedActions: actions,
      retentionStrategy,
      estimatedRetentionCost,
    };
  }
  
  /**
   * Get churn statistics
   */
  static async getStatistics(tenantId: string, dateRange?: { start: string; end: string }) {
    const supabase = getPrimaryClient();
    
    let query = supabase
      .from('auto_churn_predictions')
      .select('churn_risk_level, churn_probability, action_taken, action_result')
      .eq('tenant_id', tenantId)
      .eq('status', 'active');
    
    if (dateRange) {
      query = query
        .gte('prediction_date', dateRange.start)
        .lte('prediction_date', dateRange.end);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw new Error(`Failed to fetch churn statistics: ${error.message}`);
    }
    
    const stats = {
      total: data.length,
      byRiskLevel: { low: 0, medium: 0, high: 0, critical: 0 },
      averageChurnProbability: 0,
      actionTaken: 0,
      retentionRate: 0,
    };
    
    let totalProbability = 0;
    let retainedCount = 0;
    let actionedCount = 0;
    
    data.forEach(prediction => {
      stats.byRiskLevel[prediction.churn_risk_level as ChurnRiskLevel]++;
      totalProbability += Number(prediction.churn_probability);
      
      if (prediction.action_taken) {
        stats.actionTaken++;
        actionedCount++;
        
        if (prediction.action_result === 'retained') {
          retainedCount++;
        }
      }
    });
    
    stats.averageChurnProbability = data.length > 0 ? totalProbability / data.length : 0;
    stats.retentionRate = actionedCount > 0 ? (retainedCount / actionedCount) * 100 : 0;
    
    return stats;
  }
}
