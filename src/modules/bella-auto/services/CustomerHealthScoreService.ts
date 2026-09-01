/**
 * Customer Health Score Service
 * Calculates and tracks customer health scores based on:
 * - Engagement (interaction frequency, touchpoints)
 * - Satisfaction (NPS, CSI scores)
 * - Revenue (purchase value, frequency)
 * - Loyalty (tenure, repeat business)
 * 
 * @module bella-auto/services/CustomerHealthScoreService
 */

import { getPrimaryClient } from '@/lib/database/read-replica';
import { Database } from '@/types/database.types';

type CustomerHealthScore = Database['public']['Tables']['auto_customer_health_scores']['Row'];
type CustomerHealthScoreInsert = Database['public']['Tables']['auto_customer_health_scores']['Insert'];
type Json = Database['public']['Tables']['auto_customer_health_scores']['Row']['risk_factors'];

export interface HealthScoreComponents {
  engagementScore: number; // 0-100
  satisfactionScore: number; // 0-100
  revenueScore: number; // 0-100
  loyaltyScore: number; // 0-100
}

export interface RiskFactor {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  detectedAt: string;
}

export class CustomerHealthScoreService {
  /**
   * Calculate and save customer health score
   */
  static async calculateHealthScore(
    tenantId: string,
    customerId: string
  ): Promise<CustomerHealthScore> {
    const supabase = getPrimaryClient();

    // Calculate each component
    const engagementScore = await this.calculateEngagementScore(tenantId, customerId);
    const satisfactionScore = await this.calculateSatisfactionScore(tenantId, customerId);
    const revenueScore = await this.calculateRevenueScore(tenantId, customerId);
    const loyaltyScore = await this.calculateLoyaltyScore(tenantId, customerId);

    // Calculate weighted overall score
    const overallScore = this.calculateOverallScore({
      engagementScore,
      satisfactionScore,
      revenueScore,
      loyaltyScore,
    });

    // Identify risk factors
    const riskFactors = await this.identifyRiskFactors(
      tenantId,
      customerId,
      { engagementScore, satisfactionScore, revenueScore, loyaltyScore }
    );

    // Get last interaction dates
    const interactionData = await this.getLastInteractionData(tenantId, customerId);

    // Upsert health score
    const healthScoreData: CustomerHealthScoreInsert = {
      tenant_id: tenantId,
      customer_id: customerId,
      engagement_score: engagementScore,
      satisfaction_score: satisfactionScore,
      revenue_score: revenueScore,
      loyalty_score: loyaltyScore,
      overall_health_score: overallScore,
      health_status: this.determineHealthStatus(overallScore),
      risk_factors: riskFactors as unknown as Json,
      last_purchase_date: interactionData.lastPurchaseDate,
      last_service_date: interactionData.lastServiceDate,
      last_interaction_date: interactionData.lastInteractionDate,
      days_since_last_interaction: interactionData.daysSinceLastInteraction,
      calculated_at: new Date().toISOString(),
      calculation_version: 'v1.0',
    };

    const { data: healthScore, error } = await supabase
      .from('auto_customer_health_scores')
      .upsert(healthScoreData, {
        onConflict: 'tenant_id,customer_id',
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save health score: ${error.message}`);
    }

    return healthScore;
  }

  /**
   * Calculate engagement score (0-100)
   * Based on interaction frequency and recency
   */
  private static async calculateEngagementScore(
    tenantId: string,
    customerId: string
  ): Promise<number> {
    const supabase = getPrimaryClient();
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    // Count touchpoints in last 30 days
    const { data: recentTouchpoints } = await supabase
      .from('auto_touchpoints')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .gte('interacted_at', thirtyDaysAgo.toISOString());

    // Count touchpoints in 30-90 days ago
    const { data: olderTouchpoints } = await supabase
      .from('auto_touchpoints')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .gte('interacted_at', ninetyDaysAgo.toISOString())
      .lt('interacted_at', thirtyDaysAgo.toISOString());

    const recentCount = recentTouchpoints?.length || 0;
    const olderCount = olderTouchpoints?.length || 0;

    // Get current journey stage (one record per customer by design)
    const { data: activeJourney } = await supabase
      .from('auto_customer_journeys')
      .select('current_stage_id, entered_stage_at')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .single();

    let score = 0;

    // Recent touchpoints (0-40 points)
    if (recentCount >= 10) score += 40;
    else if (recentCount >= 5) score += 30;
    else if (recentCount >= 3) score += 20;
    else if (recentCount >= 1) score += 10;

    // Older touchpoints (0-20 points)
    if (olderCount >= 5) score += 20;
    else if (olderCount >= 3) score += 15;
    else if (olderCount >= 1) score += 10;

    // Active journey (0-20 points)
    if (activeJourney) {
      score += 10;
      
      // Bonus for recent stage entry
      if (activeJourney.entered_stage_at) {
        const enteredAt = new Date(activeJourney.entered_stage_at);
        const daysSinceEntry = Math.floor(
          (now.getTime() - enteredAt.getTime()) / (24 * 60 * 60 * 1000)
        );
        
        if (daysSinceEntry <= 7) score += 10;
        else if (daysSinceEntry <= 14) score += 5;
      }
    }

    // Recency bonus (0-20 points)
    const { data: latestTouchpoint } = await supabase
      .from('auto_touchpoints')
      .select('interacted_at')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .order('interacted_at', { ascending: false })
      .limit(1)
      .single();

    if (latestTouchpoint) {
      const daysSinceLatest = Math.floor(
        (now.getTime() - new Date(latestTouchpoint.interacted_at).getTime()) / (24 * 60 * 60 * 1000)
      );

      if (daysSinceLatest <= 7) score += 20;
      else if (daysSinceLatest <= 14) score += 15;
      else if (daysSinceLatest <= 30) score += 10;
      else if (daysSinceLatest <= 60) score += 5;
    }

    return Math.min(score, 100);
  }

  /**
   * Calculate satisfaction score (0-100)
   * Based on NPS and CSI scores
   */
  private static async calculateSatisfactionScore(
    tenantId: string,
    customerId: string
  ): Promise<number> {
    const supabase = getPrimaryClient();

    // Get latest NPS score
    const { data: latestNPS } = await supabase
      .from('auto_nps_scores')
      .select('score, category')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .single();

    // Get latest CSI score
    const { data: latestCSI } = await supabase
      .from('auto_csi_scores')
      .select('overall_csi')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .single();

    let score = 0;

    // NPS contribution (0-50 points)
    if (latestNPS) {
      // Convert 0-10 scale to 0-50
      score += (latestNPS.score / 10) * 50;
    } else {
      // Default to neutral if no NPS
      score += 35;
    }

    // CSI contribution (0-50 points)
    if (latestCSI) {
      // Convert 1-5 scale to 0-50
      score += ((latestCSI.overall_csi - 1) / 4) * 50;
    } else {
      // Default to neutral if no CSI
      score += 35;
    }

    return Math.round(score);
  }

  /**
   * Calculate revenue score (0-100)
   * Based on purchase value and frequency
   */
  private static async calculateRevenueScore(
    tenantId: string,
    customerId: string
  ): Promise<number> {
    const supabase = getPrimaryClient();
    const now = new Date();
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    // Get all journeys (no status field in schema)
    const { data: completedJourneys } = await supabase
      .from('auto_customer_journeys')
      .select('id, created_at')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .gte('created_at', oneYearAgo.toISOString());

    // Get vehicle purchases (check metadata for vehicle info since vehicle_id may not exist)
    const { data: purchases } = await supabase
      .from('auto_customer_journeys')
      .select('id, metadata')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId);

    // Get service appointments - use final_cost instead of total_amount/metadata
    const { data: serviceAppointments } = await supabase
      .from('auto_service_appointments')
      .select('id, final_cost')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .gte('appointment_date', oneYearAgo.toISOString());

    let score = 0;

    // Vehicle purchases (0-50 points)
    const purchaseCount = purchases?.length || 0;
    if (purchaseCount >= 3) score += 50;
    else if (purchaseCount >= 2) score += 40;
    else if (purchaseCount >= 1) score += 30;

    // Service appointments (0-30 points)
    const serviceCount = serviceAppointments?.length || 0;
    if (serviceCount >= 10) score += 30;
    else if (serviceCount >= 5) score += 20;
    else if (serviceCount >= 3) score += 15;
    else if (serviceCount >= 1) score += 10;

    // Service revenue (0-20 points) - use final_cost from schema
    const totalServiceRevenue = serviceAppointments?.reduce(
      (sum, appt) => sum + (appt.final_cost || 0),
      0
    ) || 0;

    if (totalServiceRevenue >= 50000000) score += 20; // 50M VND
    else if (totalServiceRevenue >= 20000000) score += 15;
    else if (totalServiceRevenue >= 10000000) score += 10;
    else if (totalServiceRevenue >= 5000000) score += 5;

    return Math.min(score, 100);
  }

  /**
   * Calculate loyalty score (0-100)
   * Based on customer tenure and repeat business
   */
  private static async calculateLoyaltyScore(
    tenantId: string,
    customerId: string
  ): Promise<number> {
    const supabase = getPrimaryClient();
    const now = new Date();

    // Get customer creation date
    const { data: customer } = await supabase
      .from('customers')
      .select('created_at')
      .eq('id', customerId)
      .single();

    if (!customer || !customer.created_at) {
      return 0;
    }

    const customerAge = now.getTime() - new Date(customer.created_at).getTime();
    const daysSinceCreation = Math.floor(customerAge / (24 * 60 * 60 * 1000));
    const yearsSinceCreation = daysSinceCreation / 365;

    let score = 0;

    // Tenure score (0-40 points)
    if (yearsSinceCreation >= 5) score += 40;
    else if (yearsSinceCreation >= 3) score += 30;
    else if (yearsSinceCreation >= 2) score += 25;
    else if (yearsSinceCreation >= 1) score += 20;
    else if (yearsSinceCreation >= 0.5) score += 15;
    else score += 10;

    // Repeat business (0-30 points)
    // Journey table: one record per customer, no status field
    const { data: completedJourneys } = await supabase
      .from('auto_customer_journeys')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId);

    const completedCount = completedJourneys?.length || 0;
    if (completedCount >= 5) score += 30;
    else if (completedCount >= 3) score += 25;
    else if (completedCount >= 2) score += 20;
    else if (completedCount >= 1) score += 15;

    // Referrals (0-15 points)
    // Note: referred_by field doesn't exist in customers table schema
    // TODO: Add referral tracking if needed
    const referralCount = 0;
    // const { data: referrals } = await supabase
    //   .from('customers')
    //   .select('id')
    //   .eq('tenant_id', tenantId)
    //   .eq('referred_by', customerId);
    // const referralCount = referrals?.length || 0;
    if (referralCount >= 5) score += 15;
    else if (referralCount >= 3) score += 10;
    else if (referralCount >= 1) score += 5;

    // Promoter status (0-15 points)
    const { data: promoterScores } = await supabase
      .from('auto_nps_scores')
      .select('category')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .eq('category', 'promoter');

    if (promoterScores && promoterScores.length > 0) {
      score += 15;
    }

    return Math.min(score, 100);
  }

  /**
   * Calculate overall health score with weights
   */
  private static calculateOverallScore(components: HealthScoreComponents): number {
    const weights = {
      engagement: 0.25,
      satisfaction: 0.35,
      revenue: 0.25,
      loyalty: 0.15,
    };

    const weightedScore =
      components.engagementScore * weights.engagement +
      components.satisfactionScore * weights.satisfaction +
      components.revenueScore * weights.revenue +
      components.loyaltyScore * weights.loyalty;

    return Math.round(weightedScore);
  }

  /**
   * Determine health status from score
   */
  private static determineHealthStatus(
    score: number
  ): 'at_risk' | 'needs_attention' | 'healthy' | 'excellent' {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'healthy';
    if (score >= 40) return 'needs_attention';
    return 'at_risk';
  }

  /**
   * Identify risk factors
   */
  private static async identifyRiskFactors(
    tenantId: string,
    customerId: string,
    components: HealthScoreComponents
  ): Promise<RiskFactor[]> {
    const supabase = getPrimaryClient();
    const riskFactors: RiskFactor[] = [];
    const now = new Date();

    // Low engagement
    if (components.engagementScore < 30) {
      riskFactors.push({
        type: 'low_engagement',
        severity: 'high',
        description: 'Tương tác rất thấp trong 90 ngày qua',
        detectedAt: now.toISOString(),
      });
    }

    // Low satisfaction
    if (components.satisfactionScore < 40) {
      riskFactors.push({
        type: 'low_satisfaction',
        severity: 'critical',
        description: 'Điểm hài lòng thấp (NPS/CSI)',
        detectedAt: now.toISOString(),
      });
    }

    // Detractor status
    const { data: recentNPS } = await supabase
      .from('auto_nps_scores')
      .select('category, score')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .single();

    if (recentNPS?.category === 'detractor') {
      riskFactors.push({
        type: 'detractor',
        severity: 'critical',
        description: `Khách hàng là Detractor (NPS: ${recentNPS.score}/10)`,
        detectedAt: now.toISOString(),
      });
    }

    // No recent purchases
    // Note: Querying journeys without status filter (field doesn't exist in schema)
    // Journey table has one record per customer by design
    const { data: recentPurchases } = await supabase
      .from('auto_customer_journeys')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .gte('created_at', new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString());

    if (!recentPurchases || recentPurchases.length === 0) {
      riskFactors.push({
        type: 'no_recent_purchase',
        severity: 'medium',
        description: 'Không có giao dịch mua xe trong 1 năm qua',
        detectedAt: now.toISOString(),
      });
    }

    // Inactive service
    const { data: recentService } = await supabase
      .from('auto_service_appointments')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .gte('appointment_date', new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString());

    if (!recentService || recentService.length === 0) {
      riskFactors.push({
        type: 'inactive_service',
        severity: 'medium',
        description: 'Không sử dụng dịch vụ trong 6 tháng qua',
        detectedAt: now.toISOString(),
      });
    }

    return riskFactors;
  }

  /**
   * Get last interaction data
   */
  private static async getLastInteractionData(
    tenantId: string,
    customerId: string
  ): Promise<{
    lastPurchaseDate: string | null;
    lastServiceDate: string | null;
    lastInteractionDate: string | null;
    daysSinceLastInteraction: number;
  }> {
    const supabase = getPrimaryClient();
    const now = new Date();

    // Last purchase (journey created_at as proxy)
    const { data: lastPurchase } = await supabase
      .from('auto_customer_journeys')
      .select('created_at')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Last service
    const { data: lastService } = await supabase
      .from('auto_service_appointments')
      .select('appointment_date')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .order('appointment_date', { ascending: false })
      .limit(1)
      .single();

    // Last touchpoint
    const { data: lastTouchpoint } = await supabase
      .from('auto_touchpoints')
      .select('interacted_at')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .order('interacted_at', { ascending: false })
      .limit(1)
      .single();

    const dates = [
      lastPurchase?.created_at,
      lastService?.appointment_date,
      lastTouchpoint?.interacted_at,
    ].filter(Boolean);

    const lastInteractionDate = dates.length > 0
      ? dates.sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime())[0]
      : null;

    const daysSinceLastInteraction = lastInteractionDate
      ? Math.floor((now.getTime() - new Date(lastInteractionDate).getTime()) / (24 * 60 * 60 * 1000))
      : 999;

    return {
      lastPurchaseDate: lastPurchase?.created_at || null,
      lastServiceDate: lastService?.appointment_date || null,
      lastInteractionDate: lastInteractionDate || null,
      daysSinceLastInteraction,
    };
  }

  /**
   * Get customers at risk
   */
  static async getCustomersAtRisk(
    tenantId: string,
    limit: number = 50
  ): Promise<CustomerHealthScore[]> {
    const supabase = getPrimaryClient();

    const { data, error } = await supabase
      .from('auto_customer_health_scores')
      .select('*, customers(*)')
      .eq('tenant_id', tenantId)
      .in('health_status', ['at_risk', 'needs_attention'])
      .order('overall_health_score', { ascending: true })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to get at-risk customers: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Batch recalculate health scores for all customers
   */
  static async batchRecalculateHealthScores(
    tenantId: string,
    customerIds?: string[]
  ): Promise<{ processed: number; errors: number }> {
    const supabase = getPrimaryClient();

    // Get customers to process
    let query = supabase
      .from('customers')
      .select('id')
      .eq('tenant_id', tenantId);

    if (customerIds && customerIds.length > 0) {
      query = query.in('id', customerIds);
    }

    const { data: customers, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch customers: ${error.message}`);
    }

    let processed = 0;
    let errors = 0;

    for (const customer of customers || []) {
      try {
        await this.calculateHealthScore(tenantId, customer.id);
        processed++;
      } catch (err: unknown) {
        console.error(`Failed to calculate health score for ${customer.id}:`, err);
        errors++;
      }
    }

    return { processed, errors };
  }
}
