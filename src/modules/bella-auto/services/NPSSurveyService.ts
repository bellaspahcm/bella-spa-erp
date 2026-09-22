/**
 * NPS Survey Service
 * Automatically triggers and manages Net Promoter Score surveys
 * after vehicle delivery and service completion
 * 
 * @module bella-auto/services/NPSSurveyService
 */

import { getPrimaryClient } from '@/lib/database/read-replica';
import { Database } from '@/types/database.types';

type AutoSurvey = Database['public']['Tables']['auto_surveys']['Row'];
type AutoSurveyInsert = Database['public']['Tables']['auto_surveys']['Insert'];
type AutoNPSScore = Database['public']['Tables']['auto_nps_scores']['Row'];
type AutoNPSScoreInsert = Database['public']['Tables']['auto_nps_scores']['Insert'];

export interface NPSSurveyTriggerContext {
  tenantId: string;
  customerId: string;
  journeyId?: string;
  vehicleId?: string;
  deliveryId?: string;
  serviceAppointmentId?: string;
  triggerEvent: 'vehicle_delivered' | 'service_completed';
}

export interface NPSResponse {
  score: number; // 0-10
  feedbackText?: string;
  followUpRequired?: boolean;
}

export class NPSSurveyService {
  /**
   * Automatically create and schedule NPS survey after trigger event
   */
  static async createAutoSurvey(
    context: NPSSurveyTriggerContext
  ): Promise<AutoSurvey> {
    const supabase = getPrimaryClient();

    // Find active NPS template for this trigger type
    const { data: template, error: templateError } = await supabase
      .from('auto_survey_templates')
      .select('*')
      .eq('tenant_id', context.tenantId)
      .eq('survey_type', 'nps')
      .eq('trigger_event', context.triggerEvent)
      .eq('is_active', true)
      .single();

    if (templateError || !template) {
      throw new Error(
        `No active NPS template found for trigger: ${context.triggerEvent}`
      );
    }

    // Calculate send time based on delay
    const sendAt = new Date();
    sendAt.setHours(sendAt.getHours() + (template.send_delay_hours || 24));

    // Calculate expiration (7 days after send)
    const expiresAt = new Date(sendAt);
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Create survey instance
    const surveyData: AutoSurveyInsert = {
      tenant_id: context.tenantId,
      template_id: template.id,
      survey_type: 'nps',
      customer_id: context.customerId,
      journey_id: context.journeyId,
      vehicle_id: context.vehicleId,
      delivery_id: context.deliveryId,
      service_appointment_id: context.serviceAppointmentId,
      status: template.auto_send ? 'pending' : 'draft',
      sent_at: template.auto_send ? sendAt.toISOString() : null,
      expires_at: expiresAt.toISOString(),
      questions: template.questions,
    };

    const { data: survey, error: surveyError } = await supabase
      .from('auto_surveys')
      .insert(surveyData)
      .select()
      .single();

    if (surveyError) {
      throw new Error(`Failed to create NPS survey: ${surveyError.message}`);
    }

    // If auto-send is enabled, trigger notification
    if (template.auto_send) {
      await this.sendSurveyNotification(survey);
    }

    return survey;
  }

  /**
   * Send survey notification to customer
   * This can be email, SMS, or in-app notification
   */
  static async sendSurveyNotification(survey: AutoSurvey): Promise<void> {
    const supabase = getPrimaryClient();

    // Get customer details
    const { data: customer } = await supabase
      .from('customers')
      .select('*')
      .eq('id', survey.customer_id)
      .single();

    if (!customer) {
      throw new Error('Customer not found');
    }

    const customerObj = customer as unknown as Record<string, unknown>;
    const customerName = (customerObj.name || customerObj.name_mother || 'Customer') as string;
    const customerEmail = (customerObj.email || 'customer@example.com') as string;

    // TODO: Integrate with notification service (email/SMS)
    // For now, just log and update status
    console.log(`[NPS Survey] Sending to ${customerName} (${customerEmail})`);

    // Update survey status to 'sent'
    await supabase
      .from('auto_surveys')
      .update({ 
        status: 'sent',
        sent_at: new Date().toISOString()
      })
      .eq('id', survey.id);
  }

  /**
   * Record NPS response from customer
   */
  static async recordNPSResponse(
    surveyId: string,
    response: NPSResponse,
    tenantId: string
  ): Promise<AutoNPSScore> {
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

    // Check if survey is still valid
    if (survey.status === 'completed') {
      throw new Error('Survey already completed');
    }

    if (survey.status === 'expired') {
      throw new Error('Survey has expired');
    }

    const now = new Date();
    if (survey.expires_at && new Date(survey.expires_at) < now) {
      // Mark as expired
      await supabase
        .from('auto_surveys')
        .update({ status: 'expired' })
        .eq('id', surveyId);
      
      throw new Error('Survey has expired');
    }

    // Validate NPS score (0-10)
    if (response.score < 0 || response.score > 10) {
      throw new Error('NPS score must be between 0 and 10');
    }

    // Store survey response
    await supabase.from('auto_survey_responses').insert({
      tenant_id: tenantId,
      survey_id: surveyId,
      question_id: 'nps_score',
      question_text: 'How likely are you to recommend us to a friend or colleague?',
      question_type: 'nps_score',
      answer_value: response.score.toString(),
      answer_numeric: response.score,
      responded_at: now.toISOString(),
    });

    // Store optional feedback
    if (response.feedbackText) {
      await supabase.from('auto_survey_responses').insert({
        tenant_id: tenantId,
        survey_id: surveyId,
        question_id: 'nps_feedback',
        question_text: 'What is the primary reason for your score?',
        question_type: 'text',
        answer_text: response.feedbackText,
        responded_at: now.toISOString(),
      });
    }

    // Create NPS score record
    const npsData: AutoNPSScoreInsert = {
      tenant_id: tenantId,
      survey_id: surveyId,
      customer_id: survey.customer_id,
      score: response.score,
      category: this.categorizeNPSScore(response.score),
      survey_type: survey.survey_type,
      vehicle_id: survey.vehicle_id,
      journey_id: survey.journey_id,
      feedback_text: response.feedbackText,
      follow_up_required: response.followUpRequired || response.score <= 6, // Auto-flag detractors
      follow_up_completed: false,
      recorded_at: now.toISOString(),
    };

    const { data: npsScore, error: npsError } = await supabase
      .from('auto_nps_scores')
      .insert(npsData)
      .select()
      .single();

    if (npsError) {
      throw new Error(`Failed to record NPS score: ${npsError.message}`);
    }

    // Update survey status to completed
    await supabase
      .from('auto_surveys')
      .update({ 
        status: 'completed',
        completed_at: now.toISOString()
      })
      .eq('id', surveyId);

    // If detractor, create next best action for follow-up
    if (response.score <= 6) {
      await this.createDetractorFollowUpAction(survey, npsScore);
    }

    return npsScore;
  }

  /**
   * Categorize NPS score
   */
  private static categorizeNPSScore(score: number): 'detractor' | 'passive' | 'promoter' {
    if (score >= 0 && score <= 6) return 'detractor';
    if (score >= 7 && score <= 8) return 'passive';
    return 'promoter';
  }

  /**
   * Create follow-up action for detractors
   */
  private static async createDetractorFollowUpAction(
    survey: AutoSurvey,
    npsScore: AutoNPSScore
  ): Promise<void> {
    const supabase = getPrimaryClient();

    // Get customer journey to find assigned sales consultant
    const { data: journey } = await supabase
      .from('auto_customer_journeys')
      .select('assigned_to')
      .eq('id', survey.journey_id || '')
      .single();

    await supabase.from('auto_next_best_actions').insert({
      tenant_id: survey.tenant_id,
      customer_id: survey.customer_id,
      journey_id: survey.journey_id,
      action_type: 'follow_up_detractor',
      action_priority: 'high',
      action_title: 'Khách hàng không hài lòng - Cần liên hệ ngay',
      action_description: `Khách hàng vừa đánh giá NPS ${npsScore.score}/10 (Detractor). ${
        npsScore.feedback_text ? `Phản hồi: "${npsScore.feedback_text}"` : 'Cần liên hệ để hiểu rõ nguyên nhân và khắc phục.'
      }`,
      reason: `NPS score ${npsScore.score} indicates customer dissatisfaction. Immediate follow-up required to prevent negative word-of-mouth.`,
      confidence_score: 1.0,
      data_points: {
        nps_score: npsScore.score,
        survey_type: survey.survey_type,
        feedback: npsScore.feedback_text,
      },
      assigned_to: journey?.assigned_to,
      status: 'pending',
      valid_until: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // 48 hours
    });
  }

  /**
   * Calculate NPS for a given period
   * NPS = % Promoters - % Detractors
   */
  static async calculateNPS(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    filters?: {
      surveyType?: string;
      vehicleId?: string;
    }
  ): Promise<{
    nps: number;
    totalResponses: number;
    promoters: number;
    passives: number;
    detractors: number;
    promoterPercentage: number;
    passivePercentage: number;
    detractorPercentage: number;
  }> {
    const supabase = getPrimaryClient();

    let query = supabase
      .from('auto_nps_scores')
      .select('score, category')
      .eq('tenant_id', tenantId)
      .gte('recorded_at', startDate.toISOString())
      .lte('recorded_at', endDate.toISOString());

    if (filters?.surveyType) {
      query = query.eq('survey_type', filters.surveyType);
    }

    if (filters?.vehicleId) {
      query = query.eq('vehicle_id', filters.vehicleId);
    }

    const { data: scores, error } = await query;

    if (error) {
      throw new Error(`Failed to calculate NPS: ${error.message}`);
    }

    if (!scores || scores.length === 0) {
      return {
        nps: 0,
        totalResponses: 0,
        promoters: 0,
        passives: 0,
        detractors: 0,
        promoterPercentage: 0,
        passivePercentage: 0,
        detractorPercentage: 0,
      };
    }

    const totalResponses = scores.length;
    const promoters = scores.filter((s) => s.category === 'promoter').length;
    const passives = scores.filter((s) => s.category === 'passive').length;
    const detractors = scores.filter((s) => s.category === 'detractor').length;

    const promoterPercentage = (promoters / totalResponses) * 100;
    const passivePercentage = (passives / totalResponses) * 100;
    const detractorPercentage = (detractors / totalResponses) * 100;

    const nps = Math.round(promoterPercentage - detractorPercentage);

    return {
      nps,
      totalResponses,
      promoters,
      passives,
      detractors,
      promoterPercentage: Math.round(promoterPercentage * 10) / 10,
      passivePercentage: Math.round(passivePercentage * 10) / 10,
      detractorPercentage: Math.round(detractorPercentage * 10) / 10,
    };
  }

  /**
   * Get NPS trend over time
   */
  static async getNPSTrend(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    groupBy: 'day' | 'week' | 'month' = 'month'
  ): Promise<Array<{
    period: string;
    nps: number;
    totalResponses: number;
  }>> {
    const supabase = getPrimaryClient();

    // This would require a more complex query with date grouping
    // For now, return empty array as placeholder
    // TODO: Implement with proper date bucketing
    return [];
  }

  /**
   * Get detractors requiring follow-up
   */
  static async getDetractorsRequiringFollowUp(
    tenantId: string
  ): Promise<AutoNPSScore[]> {
    const supabase = getPrimaryClient();

    const { data, error } = await supabase
      .from('auto_nps_scores')
      .select('*, customers(*), auto_surveys(*)')
      .eq('tenant_id', tenantId)
      .eq('follow_up_required', true)
      .eq('follow_up_completed', false)
      .order('recorded_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get detractors: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Mark detractor follow-up as completed
   */
  static async markFollowUpCompleted(
    npsScoreId: string,
    tenantId: string
  ): Promise<void> {
    const supabase = getPrimaryClient();

    const { error } = await supabase
      .from('auto_nps_scores')
      .update({ follow_up_completed: true })
      .eq('id', npsScoreId)
      .eq('tenant_id', tenantId);

    if (error) {
      throw new Error(`Failed to mark follow-up completed: ${error.message}`);
    }
  }
}
