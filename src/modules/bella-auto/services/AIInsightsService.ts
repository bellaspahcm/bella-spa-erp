/**
 * Bella Auto Phase 9 - AI Insights Service
 * 
 * Manages AI-generated insights, CEO queries, and predictions.
 * This is the foundation layer - actual AI model integration comes later.
 * 
 * Features:
 * - Store and retrieve AI insights
 * - CEO natural language query history
 * - Next best action recommendations
 * - Lost deal analysis
 * - Performance alerts
 * 
 * @module bella-auto/services/AIInsightsService
 */

import { getPrimaryClient } from '@/lib/database/read-replica';
import { Database } from '@/types/database.types';

type AIInsight = Database['public']['Tables']['auto_ai_insights']['Row'];
type AIInsightInsert = Database['public']['Tables']['auto_ai_insights']['Insert'];
type AIInsightUpdate = Database['public']['Tables']['auto_ai_insights']['Update'];

type InsightType = 
  | 'ceo_query'
  | 'next_best_action'
  | 'lost_analysis'
  | 'performance_alert'
  | 'recommendation'
  | 'prediction';

type Priority = 'low' | 'medium' | 'high' | 'critical';
type Status = 'new' | 'reviewed' | 'actioned' | 'dismissed';

interface CreateInsightParams {
  tenantId: string;
  insightType: InsightType;
  title: string;
  summary: string;
  details?: Record<string, unknown>;
  queryText?: string;
  queryIntent?: string;
  queryParameters?: Record<string, unknown>;
  modelName?: string;
  modelVersion?: string;
  confidenceScore?: number;
  customerId?: string;
  journeyId?: string;
  saleId?: string;
  leadId?: string;
  suggestedActions?: Record<string, unknown>[];
  priority?: Priority;
  expiresAt?: string;
  createdBy?: string;
}

interface ActionResult {
  insightId: string;
  actionTaken: boolean;
  actionResult?: string;
  actionTakenBy?: string;
}

export class AIInsightsService {
  /**
   * Create new AI insight
   */
  static async create(params: CreateInsightParams): Promise<AIInsight> {
    const supabase = getPrimaryClient();
    
    const insightData: AIInsightInsert = {
      tenant_id: params.tenantId,
      insight_type: params.insightType,
      insight_title: params.title,
      insight_summary: params.summary,
      insight_details: params.details as AIInsightInsert['insight_details'],
      query_text: params.queryText,
      query_intent: params.queryIntent,
      query_parameters: params.queryParameters as AIInsightInsert['query_parameters'],
      model_name: params.modelName,
      model_version: params.modelVersion,
      confidence_score: params.confidenceScore,
      customer_id: params.customerId,
      journey_id: params.journeyId,
      sale_id: params.saleId,
      lead_id: params.leadId,
      suggested_actions: params.suggestedActions as AIInsightInsert['suggested_actions'],
      priority: params.priority || 'medium',
      expires_at: params.expiresAt,
      status: 'new',
      created_by: params.createdBy,
    };
    
    const { data, error } = await supabase
      .from('auto_ai_insights')
      .insert(insightData)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to create AI insight: ${error.message}`);
    }
    
    return data;
  }
  
  /**
   * Get insight by ID
   */
  static async getById(insightId: string, tenantId: string): Promise<AIInsight | null> {
    const supabase = getPrimaryClient();
    
    const { data, error } = await supabase
      .from('auto_ai_insights')
      .select('*')
      .eq('id', insightId)
      .eq('tenant_id', tenantId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch AI insight: ${error.message}`);
    }
    
    return data;
  }
  
  /**
   * Get active insights for dashboard (using RPC)
   */
  static async getActiveInsights(tenantId: string, limit: number = 10) {
    const supabase = getPrimaryClient();
    
    const { data, error } = await supabase
      .rpc('get_active_ai_insights', {
        p_tenant_id: tenantId,
        p_limit: limit,
      });
    
    if (error) {
      throw new Error(`Failed to fetch active insights: ${error.message}`);
    }
    
    return data || [];
  }
  
  /**
   * Get insights by type
   */
  static async getByType(
    tenantId: string,
    insightType: InsightType,
    limit?: number
  ): Promise<AIInsight[]> {
    const supabase = getPrimaryClient();
    
    let query = supabase
      .from('auto_ai_insights')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('insight_type', insightType)
      .order('created_at', { ascending: false });
    
    if (limit) {
      query = query.limit(limit);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw new Error(`Failed to fetch insights by type: ${error.message}`);
    }
    
    return data || [];
  }
  
  /**
   * Get insights by customer
   */
  static async getByCustomer(
    customerId: string,
    tenantId: string
  ): Promise<AIInsight[]> {
    const supabase = getPrimaryClient();
    
    const { data, error } = await supabase
      .from('auto_ai_insights')
      .select('*')
      .eq('customer_id', customerId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    
    if (error) {
      throw new Error(`Failed to fetch customer insights: ${error.message}`);
    }
    
    return data || [];
  }
  
  /**
   * Update insight status
   */
  static async updateStatus(
    insightId: string,
    tenantId: string,
    status: Status,
    updatedBy?: string
  ): Promise<AIInsight> {
    const supabase = getPrimaryClient();
    
    const { data, error } = await supabase
      .from('auto_ai_insights')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', insightId)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to update insight status: ${error.message}`);
    }
    
    return data;
  }
  
  /**
   * Mark insight as actioned
   */
  static async markActioned(
    insightId: string,
    tenantId: string,
    actionResult: string,
    actionedBy?: string
  ): Promise<AIInsight> {
    const supabase = getPrimaryClient();
    
    const { data, error } = await supabase
      .from('auto_ai_insights')
      .update({
        action_taken: true,
        action_taken_at: new Date().toISOString(),
        action_taken_by: actionedBy,
        action_result: actionResult,
        status: 'actioned',
      })
      .eq('id', insightId)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to mark insight as actioned: ${error.message}`);
    }
    
    return data;
  }
  
  /**
   * Dismiss insight
   */
  static async dismiss(
    insightId: string,
    tenantId: string,
    dismissedBy?: string
  ): Promise<AIInsight> {
    return this.updateStatus(insightId, tenantId, 'dismissed', dismissedBy);
  }
  
  /**
   * Record CEO query
   */
  static async recordCEOQuery(params: {
    tenantId: string;
    queryText: string;
    queryIntent?: string;
    queryParameters?: Record<string, unknown>;
    result: {
      title: string;
      summary: string;
      details: Record<string, unknown>;
    };
    modelName?: string;
    confidenceScore?: number;
    createdBy?: string;
  }): Promise<AIInsight> {
    return this.create({
      tenantId: params.tenantId,
      insightType: 'ceo_query',
      title: params.result.title,
      summary: params.result.summary,
      details: params.result.details,
      queryText: params.queryText,
      queryIntent: params.queryIntent,
      queryParameters: params.queryParameters,
      modelName: params.modelName || 'ceo-query-engine-v1',
      confidenceScore: params.confidenceScore,
      priority: 'medium',
      createdBy: params.createdBy,
    });
  }
  
  /**
   * Create next best action recommendation
   */
  static async createNextBestAction(params: {
    tenantId: string;
    customerId?: string;
    leadId?: string;
    journeyId?: string;
    title: string;
    summary: string;
    suggestedActions: Record<string, unknown>[];
    priority?: Priority;
    confidenceScore?: number;
    createdBy?: string;
  }): Promise<AIInsight> {
    return this.create({
      tenantId: params.tenantId,
      insightType: 'next_best_action',
      title: params.title,
      summary: params.summary,
      customerId: params.customerId,
      leadId: params.leadId,
      journeyId: params.journeyId,
      suggestedActions: params.suggestedActions,
      priority: params.priority || 'high',
      confidenceScore: params.confidenceScore,
      modelName: 'next-best-action-v1',
      createdBy: params.createdBy,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
    });
  }
  
  /**
   * Create lost deal analysis
   */
  static async createLostAnalysis(params: {
    tenantId: string;
    saleId: string;
    customerId?: string;
    journeyId?: string;
    lostReason: string;
    analysis: {
      title: string;
      summary: string;
      details: Record<string, unknown>;
    };
    preventionActions: Record<string, unknown>[];
    confidenceScore?: number;
    createdBy?: string;
  }): Promise<AIInsight> {
    return this.create({
      tenantId: params.tenantId,
      insightType: 'lost_analysis',
      title: params.analysis.title,
      summary: params.analysis.summary,
      details: {
        ...params.analysis.details,
        lost_reason: params.lostReason,
      },
      saleId: params.saleId,
      customerId: params.customerId,
      journeyId: params.journeyId,
      suggestedActions: params.preventionActions,
      priority: 'high',
      confidenceScore: params.confidenceScore,
      modelName: 'lost-analysis-v1',
      createdBy: params.createdBy,
    });
  }
  
  /**
   * Create performance alert
   */
  static async createPerformanceAlert(params: {
    tenantId: string;
    title: string;
    summary: string;
    details: Record<string, unknown>;
    priority: Priority;
    suggestedActions?: Record<string, unknown>[];
    createdBy?: string;
  }): Promise<AIInsight> {
    return this.create({
      tenantId: params.tenantId,
      insightType: 'performance_alert',
      title: params.title,
      summary: params.summary,
      details: params.details,
      priority: params.priority,
      suggestedActions: params.suggestedActions,
      modelName: 'performance-monitor-v1',
      createdBy: params.createdBy,
    });
  }
  
  /**
   * Get insights statistics
   */
  static async getStatistics(tenantId: string, dateRange?: { start: string; end: string }) {
    const supabase = getPrimaryClient();
    
    let query = supabase
      .from('auto_ai_insights')
      .select('insight_type, status, priority, confidence_score')
      .eq('tenant_id', tenantId);
    
    if (dateRange) {
      query = query
        .gte('created_at', dateRange.start)
        .lte('created_at', dateRange.end);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw new Error(`Failed to fetch insights statistics: ${error.message}`);
    }
    
    const stats = {
      total: data.length,
      byType: {} as Record<string, number>,
      byStatus: {} as Record<string, number>,
      byPriority: {} as Record<string, number>,
      averageConfidence: 0,
      actionedRate: 0,
    };
    
    let totalConfidence = 0;
    let confidenceCount = 0;
    let actionedCount = 0;
    
    data.forEach(insight => {
      // By type
      stats.byType[insight.insight_type] = (stats.byType[insight.insight_type] || 0) + 1;
      
      // By status
      stats.byStatus[insight.status] = (stats.byStatus[insight.status] || 0) + 1;
      
      // By priority
      if (insight.priority) {
        stats.byPriority[insight.priority] = (stats.byPriority[insight.priority] || 0) + 1;
      }
      
      // Confidence
      if (insight.confidence_score) {
        totalConfidence += Number(insight.confidence_score);
        confidenceCount++;
      }
      
      // Actioned
      if (insight.status === 'actioned') {
        actionedCount++;
      }
    });
    
    stats.averageConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0;
    stats.actionedRate = stats.total > 0 ? (actionedCount / stats.total) * 100 : 0;
    
    return stats;
  }
  
  /**
   * Clean up expired insights
   */
  static async cleanupExpired(tenantId: string): Promise<number> {
    const supabase = getPrimaryClient();
    
    const { data, error } = await supabase
      .from('auto_ai_insights')
      .delete()
      .eq('tenant_id', tenantId)
      .lt('expires_at', new Date().toISOString())
      .select();
    
    if (error) {
      throw new Error(`Failed to cleanup expired insights: ${error.message}`);
    }
    
    return data?.length || 0;
  }
}
