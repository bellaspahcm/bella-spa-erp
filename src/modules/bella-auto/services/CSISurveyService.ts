/**
 * CSI Survey Service
 * Manages Customer Satisfaction Index surveys across multiple dimensions
 * 
 * @module bella-auto/services/CSISurveyService
 */

import { getPrimaryClient } from '@/lib/database/read-replica';
import { Database } from '@/types/database.types';

type AutoCSIScore = Database['public']['Tables']['auto_csi_scores']['Row'];
type AutoCSIScoreInsert = Database['public']['Tables']['auto_csi_scores']['Insert'];
type AutoSurvey = Database['public']['Tables']['auto_surveys']['Row'];

export interface CSIDimensions {
  salesConsultantScore: number; // 1-5
  facilityScore: number; // 1-5
  deliveryTimingScore: number; // 1-5
  vehicleQualityScore: number; // 1-5
  afterSalesScore: number; // 1-5
}

export interface CSIFeedback {
  positiveFeedback?: string;
  negativeFeedback?: string;
  improvementSuggestions?: string;
}

export interface CSIResponse extends CSIDimensions, CSIFeedback {}

export class CSISurveyService {
  /**
   * Create CSI survey after vehicle delivery
   */
  static async createCSISurvey(context: {
    tenantId: string;
    customerId: string;
    journeyId?: string;
    vehicleId?: string;
    deliveryId?: string;
    salesConsultantId?: string;
  }): Promise<AutoSurvey> {
    const supabase = getPrimaryClient();

    // Find active CSI template
    const { data: template, error: templateError } = await supabase
      .from('auto_survey_templates')
      .select('*')
      .eq('tenant_id', context.tenantId)
      .eq('survey_type', 'csi')
      .eq('trigger_event', 'vehicle_delivered')
      .eq('is_active', true)
      .single();

    if (templateError || !template) {
      throw new Error('No active CSI template found for delivery');
    }

    // Calculate send time
    const sendAt = new Date();
    sendAt.setHours(sendAt.getHours() + (template.send_delay_hours || 24));

    // Calculate expiration (14 days after send)
    const expiresAt = new Date(sendAt);
    expiresAt.setDate(expiresAt.getDate() + 14);

    // Create survey instance
    const { data: survey, error: surveyError } = await supabase
      .from('auto_surveys')
      .insert({
        tenant_id: context.tenantId,
        template_id: template.id,
        survey_type: 'csi',
        customer_id: context.customerId,
        journey_id: context.journeyId,
        vehicle_id: context.vehicleId,
        delivery_id: context.deliveryId,
        status: template.auto_send ? 'pending' : 'draft',
        sent_at: template.auto_send ? sendAt.toISOString() : null,
        expires_at: expiresAt.toISOString(),
        questions: template.questions,
      })
      .select()
      .single();

    if (surveyError) {
      throw new Error(`Failed to create CSI survey: ${surveyError.message}`);
    }

    return survey;
  }

  /**
   * Record CSI response from customer
   */
  static async recordCSIResponse(
    surveyId: string,
    response: CSIResponse,
    tenantId: string
  ): Promise<AutoCSIScore> {
    const supabase = getPrimaryClient();

    // Get survey details
    const { data: survey, error: surveyError } = await supabase
      .from('auto_surveys')
      .select('*')
      .eq('id', surveyId)
      .eq('tenant_id', tenantId)
      .single();

    if (surveyError || !survey) {
      throw new Error('Survey not found');
    }

    // Validate survey status
    if (survey.status === 'completed') {
      throw new Error('Survey already completed');
    }

    if (survey.status === 'expired') {
      throw new Error('Survey has expired');
    }

    // Validate all dimension scores (1-5)
    const dimensions = [
      response.salesConsultantScore,
      response.facilityScore,
      response.deliveryTimingScore,
      response.vehicleQualityScore,
      response.afterSalesScore,
    ];

    for (const score of dimensions) {
      if (score < 1 || score > 5) {
        throw new Error('All dimension scores must be between 1 and 5');
      }
    }

    const now = new Date();

    // Store individual dimension responses
    const dimensionQuestions = [
      { id: 'sales_consultant', text: 'Chất lượng phục vụ của tư vấn bán hàng', score: response.salesConsultantScore },
      { id: 'facility', text: 'Cơ sở vật chất showroom', score: response.facilityScore },
      { id: 'delivery_timing', text: 'Thời gian giao xe', score: response.deliveryTimingScore },
      { id: 'vehicle_quality', text: 'Chất lượng xe khi nhận', score: response.vehicleQualityScore },
      { id: 'after_sales', text: 'Dịch vụ hậu mãi', score: response.afterSalesScore },
    ];

    for (const question of dimensionQuestions) {
      await supabase.from('auto_survey_responses').insert({
        tenant_id: tenantId,
        survey_id: surveyId,
        question_id: question.id,
        question_text: question.text,
        question_type: 'rating',
        answer_numeric: question.score,
        answer_value: question.score.toString(),
        responded_at: now.toISOString(),
      });
    }

    // Store feedback responses
    if (response.positiveFeedback) {
      await supabase.from('auto_survey_responses').insert({
        tenant_id: tenantId,
        survey_id: surveyId,
        question_id: 'positive_feedback',
        question_text: 'Điều gì bạn hài lòng nhất?',
        question_type: 'text',
        answer_text: response.positiveFeedback,
        responded_at: now.toISOString(),
      });
    }

    if (response.negativeFeedback) {
      await supabase.from('auto_survey_responses').insert({
        tenant_id: tenantId,
        survey_id: surveyId,
        question_id: 'negative_feedback',
        question_text: 'Điều gì bạn chưa hài lòng?',
        question_type: 'text',
        answer_text: response.negativeFeedback,
        responded_at: now.toISOString(),
      });
    }

    if (response.improvementSuggestions) {
      await supabase.from('auto_survey_responses').insert({
        tenant_id: tenantId,
        survey_id: surveyId,
        question_id: 'improvement_suggestions',
        question_text: 'Đề xuất cải thiện',
        question_type: 'text',
        answer_text: response.improvementSuggestions,
        responded_at: now.toISOString(),
      });
    }

    // Calculate overall CSI (weighted average)
    const overallCSI = this.calculateOverallCSI(response);

    // Get journey to find sales consultant
    let salesConsultantId: string | null = null;
    // Note: assigned_to field doesn't exist in auto_customer_journeys schema
    // TODO: Implement sales consultant tracking if needed
    if (survey.journey_id) {
      // const { data: journey } = await supabase
      //   .from('auto_customer_journeys')
      //   .select('assigned_to')
      //   .eq('id', survey.journey_id)
      //   .single();
      // salesConsultantId = journey?.assigned_to || null;
      salesConsultantId = null;
    }

    // Create CSI score record
    const csiData: AutoCSIScoreInsert = {
      tenant_id: tenantId,
      survey_id: surveyId,
      customer_id: survey.customer_id,
      sales_consultant_score: response.salesConsultantScore,
      facility_score: response.facilityScore,
      delivery_timing_score: response.deliveryTimingScore,
      vehicle_quality_score: response.vehicleQualityScore,
      after_sales_score: response.afterSalesScore,
      overall_csi: overallCSI,
      survey_type: survey.survey_type,
      vehicle_id: survey.vehicle_id,
      journey_id: survey.journey_id,
      sales_consultant_id: salesConsultantId,
      positive_feedback: response.positiveFeedback,
      negative_feedback: response.negativeFeedback,
      improvement_suggestions: response.improvementSuggestions,
      recorded_at: now.toISOString(),
    };

    const { data: csiScore, error: csiError } = await supabase
      .from('auto_csi_scores')
      .insert(csiData)
      .select()
      .single();

    if (csiError) {
      throw new Error(`Failed to record CSI score: ${csiError.message}`);
    }

    // Update survey status
    await supabase
      .from('auto_surveys')
      .update({
        status: 'completed',
        completed_at: now.toISOString(),
      })
      .eq('id', surveyId);

    // If CSI is low, create follow-up action
    if (overallCSI < 3.0) {
      await this.createLowCSIFollowUpAction(survey, csiScore);
    }

    return csiScore;
  }

  /**
   * Calculate overall CSI from dimensions
   * Using weighted average (can be customized)
   */
  private static calculateOverallCSI(response: CSIDimensions): number {
    // Weights can be adjusted based on business priorities
    const weights = {
      salesConsultant: 0.25,
      facility: 0.15,
      deliveryTiming: 0.20,
      vehicleQuality: 0.25,
      afterSales: 0.15,
    };

    const weightedSum =
      response.salesConsultantScore * weights.salesConsultant +
      response.facilityScore * weights.facility +
      response.deliveryTimingScore * weights.deliveryTiming +
      response.vehicleQualityScore * weights.vehicleQuality +
      response.afterSalesScore * weights.afterSales;

    return Math.round(weightedSum * 100) / 100;
  }

  /**
   * Create follow-up action for low CSI scores
   */
  private static async createLowCSIFollowUpAction(
    survey: AutoSurvey,
    csiScore: AutoCSIScore
  ): Promise<void> {
    const supabase = getPrimaryClient();

    // Identify which dimensions are problematic
    const lowDimensions: string[] = [];
    if (csiScore.sales_consultant_score && csiScore.sales_consultant_score < 3) {
      lowDimensions.push('Tư vấn bán hàng');
    }
    if (csiScore.facility_score && csiScore.facility_score < 3) {
      lowDimensions.push('Cơ sở vật chất');
    }
    if (csiScore.delivery_timing_score && csiScore.delivery_timing_score < 3) {
      lowDimensions.push('Thời gian giao xe');
    }
    if (csiScore.vehicle_quality_score && csiScore.vehicle_quality_score < 3) {
      lowDimensions.push('Chất lượng xe');
    }
    if (csiScore.after_sales_score && csiScore.after_sales_score < 3) {
      lowDimensions.push('Dịch vụ hậu mãi');
    }

    await supabase.from('auto_next_best_actions').insert({
      tenant_id: survey.tenant_id,
      customer_id: survey.customer_id,
      journey_id: survey.journey_id,
      action_type: 'follow_up_low_csi',
      action_priority: 'high',
      action_title: `CSI thấp (${csiScore.overall_csi}/5) - Cần khắc phục`,
      action_description: `Khách hàng đánh giá CSI ${csiScore.overall_csi}/5. Các chiều yếu: ${lowDimensions.join(', ')}. ${
        csiScore.negative_feedback ? `Phản hồi: "${csiScore.negative_feedback}"` : ''
      }`,
      reason: `Low CSI score indicates customer dissatisfaction. Immediate action required to improve experience.`,
      confidence_score: 1.0,
      data_points: {
        overall_csi: csiScore.overall_csi,
        low_dimensions: lowDimensions,
        negative_feedback: csiScore.negative_feedback,
      },
      assigned_to: csiScore.sales_consultant_id,
      status: 'pending',
      valid_until: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(), // 72 hours
    });
  }

  /**
   * Calculate average CSI for a period
   */
  static async calculateAverageCSI(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    filters?: {
      salesConsultantId?: string;
      vehicleId?: string;
    }
  ): Promise<{
    overallAverage: number;
    dimensionAverages: {
      salesConsultant: number;
      facility: number;
      deliveryTiming: number;
      vehicleQuality: number;
      afterSales: number;
    };
    totalResponses: number;
  }> {
    const supabase = getPrimaryClient();

    let query = supabase
      .from('auto_csi_scores')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('recorded_at', startDate.toISOString())
      .lte('recorded_at', endDate.toISOString());

    if (filters?.salesConsultantId) {
      query = query.eq('sales_consultant_id', filters.salesConsultantId);
    }

    if (filters?.vehicleId) {
      query = query.eq('vehicle_id', filters.vehicleId);
    }

    const { data: scores, error } = await query;

    if (error) {
      throw new Error(`Failed to calculate CSI: ${error.message}`);
    }

    if (!scores || scores.length === 0) {
      return {
        overallAverage: 0,
        dimensionAverages: {
          salesConsultant: 0,
          facility: 0,
          deliveryTiming: 0,
          vehicleQuality: 0,
          afterSales: 0,
        },
        totalResponses: 0,
      };
    }

    const totalResponses = scores.length;

    const sumDimensions = scores.reduce(
      (acc, score) => ({
        overall: acc.overall + (score.overall_csi || 0),
        salesConsultant: acc.salesConsultant + (score.sales_consultant_score || 0),
        facility: acc.facility + (score.facility_score || 0),
        deliveryTiming: acc.deliveryTiming + (score.delivery_timing_score || 0),
        vehicleQuality: acc.vehicleQuality + (score.vehicle_quality_score || 0),
        afterSales: acc.afterSales + (score.after_sales_score || 0),
      }),
      {
        overall: 0,
        salesConsultant: 0,
        facility: 0,
        deliveryTiming: 0,
        vehicleQuality: 0,
        afterSales: 0,
      }
    );

    return {
      overallAverage: Math.round((sumDimensions.overall / totalResponses) * 100) / 100,
      dimensionAverages: {
        salesConsultant: Math.round((sumDimensions.salesConsultant / totalResponses) * 100) / 100,
        facility: Math.round((sumDimensions.facility / totalResponses) * 100) / 100,
        deliveryTiming: Math.round((sumDimensions.deliveryTiming / totalResponses) * 100) / 100,
        vehicleQuality: Math.round((sumDimensions.vehicleQuality / totalResponses) * 100) / 100,
        afterSales: Math.round((sumDimensions.afterSales / totalResponses) * 100) / 100,
      },
      totalResponses,
    };
  }

  /**
   * Get CSI scores by sales consultant
   */
  static async getCSIByConsultant(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Array<{
    consultantId: string;
    consultantName: string;
    averageCSI: number;
    totalSurveys: number;
  }>> {
    const supabase = getPrimaryClient();

    type ScoreWithEmployee = {
      sales_consultant_id: string | null;
      overall_csi: number | null;
      employees: { name: string } | null;
    };

    const { data: scores, error } = await supabase
      .from('auto_csi_scores')
      .select('sales_consultant_id, overall_csi, employees(name)')
      .eq('tenant_id', tenantId)
      .gte('recorded_at', startDate.toISOString())
      .lte('recorded_at', endDate.toISOString())
      .not('sales_consultant_id', 'is', null)
      .returns<ScoreWithEmployee[]>();

    if (error) {
      throw new Error(`Failed to get CSI by consultant: ${error.message}`);
    }

    if (!scores || scores.length === 0) {
      return [];
    }

    // Group by consultant
    const consultantMap = new Map<string, { sum: number; count: number; name: string }>();

    for (const score of scores) {
      if (!score.sales_consultant_id) continue;

      const existing = consultantMap.get(score.sales_consultant_id);
      if (existing) {
        existing.sum += score.overall_csi || 0;
        existing.count += 1;
      } else {
        consultantMap.set(score.sales_consultant_id, {
          sum: score.overall_csi || 0,
          count: 1,
          name: score.employees?.name || 'Unknown',
        });
      }
    }

    // Convert to array
    return Array.from(consultantMap.entries()).map(([consultantId, data]) => ({
      consultantId,
      consultantName: data.name,
      averageCSI: Math.round((data.sum / data.count) * 100) / 100,
      totalSurveys: data.count,
    }));
  }
}
