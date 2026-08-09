/**
 * Lost Analysis AI Service
 * Analyzes why customers are lost at various stages of the journey
 * Provides AI-driven insights and prevention recommendations
 * 
 * @module bella-auto/services/LostAnalysisAIService
 */

import { getPrimaryClient } from '@/lib/database/read-replica';
import { Database } from '@/types/database.types';

type LostAnalysis = Database['public']['Tables']['auto_lost_analysis']['Row'];
type LostAnalysisInsert = Database['public']['Tables']['auto_lost_analysis']['Insert'];
type LostAnalysisUpdate = Database['public']['Tables']['auto_lost_analysis']['Update'];

interface AIAnalysisRecord {
  recoverabilityScore: number;
  rootCauses: string[];
  contributingFactors: string[];
  preventionSuggestions: string[];
  recommendedActions: string[];
  similarCases: number;
}

export interface LostReason {
  primary: string;
  secondary: string[];
  category: 'price' | 'product' | 'service' | 'competition' | 'timing' | 'other';
}

export interface CompetitorInfo {
  brand?: string;
  model?: string;
  price?: number;
  priceDifference?: number;
  advantages?: string[];
}

export interface LostOpportunityData {
  customerId: string;
  journeyId: string;
  lostAtStage: string;
  lostDate: Date;
  reason: LostReason;
  competitorInfo?: CompetitorInfo;
  customerFeedback?: string;
  salesConsultantId?: string;
  consultantNotes?: string;
}

export interface AIAnalysisResult {
  rootCauses: string[];
  contributingFactors: string[];
  preventionSuggestions: string[];
  similarCases: number;
  recoverabilityScore: number; // 0-1, likelihood of winning back
  recommendedActions: string[];
}

export class LostAnalysisAIService {
  /**
   * Record a lost opportunity
   */
  static async recordLostOpportunity(
    tenantId: string,
    data: LostOpportunityData
  ): Promise<LostAnalysis> {
    const supabase = getPrimaryClient();

    // Create lost analysis record
    const lostData: LostAnalysisInsert = {
      tenant_id: tenantId,
      customer_id: data.customerId,
      journey_id: data.journeyId,
      lost_at_stage: data.lostAtStage,
      lost_date: data.lostDate.toISOString().split('T')[0],
      primary_reason: data.reason.primary,
      secondary_reasons: data.reason.secondary as LostAnalysisInsert['secondary_reasons'],
      competitor_brand: data.competitorInfo?.brand,
      competitor_model: data.competitorInfo?.model,
      competitor_price: data.competitorInfo?.price,
      price_difference: data.competitorInfo?.priceDifference,
      customer_feedback: data.customerFeedback,
      sales_consultant_id: data.salesConsultantId,
      consultant_notes: data.consultantNotes,
      ai_analyzed: false,
    };

    const { data: lostAnalysis, error } = await supabase
      .from('auto_lost_analysis')
      .insert(lostData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to record lost opportunity: ${error.message}`);
    }

    // Update journey status to lost
    await supabase
      .from('auto_customer_journeys')
      .update({
        status: 'lost',
        lost_at_stage: data.lostAtStage,
        lost_reason: data.reason.primary,
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.journeyId)
      .eq('tenant_id', tenantId);

    // Trigger AI analysis asynchronously
    // In production, this would be a background job
    setTimeout(() => {
      this.performAIAnalysis(tenantId, lostAnalysis.id).catch(console.error);
    }, 0);

    return lostAnalysis;
  }

  /**
   * Perform AI analysis on lost opportunity
   */
  static async performAIAnalysis(
    tenantId: string,
    lostAnalysisId: string
  ): Promise<AIAnalysisResult> {
    const supabase = getPrimaryClient();

    // Get lost analysis record
    const { data: lostAnalysis, error: fetchError } = await supabase
      .from('auto_lost_analysis')
      .select('*, customers(*), auto_customer_journeys(*)')
      .eq('id', lostAnalysisId)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !lostAnalysis) {
      throw new Error('Lost analysis record not found');
    }

    // Perform analysis
    const analysis = await this.analyzeRootCauses(tenantId, lostAnalysis);

    // Save analysis result
    await supabase
      .from('auto_lost_analysis')
      .update({
        ai_analyzed: true,
        ai_analysis_result: analysis as LostAnalysisUpdate['ai_analysis_result'],
        ai_prevention_suggestions: analysis.preventionSuggestions as LostAnalysisUpdate['ai_prevention_suggestions'],
        updated_at: new Date().toISOString(),
      })
      .eq('id', lostAnalysisId)
      .eq('tenant_id', tenantId);

    // Create recovery action if recoverable
    if (analysis.recoverabilityScore > 0.5) {
      await this.createRecoveryAction(tenantId, lostAnalysis, analysis);
    }

    return analysis;
  }

  /**
   * Analyze root causes using AI logic
   */
  private static async analyzeRootCauses(
    tenantId: string,
    lostAnalysis: LostAnalysis
  ): Promise<AIAnalysisResult> {
    const supabase = getPrimaryClient();

    const rootCauses: string[] = [];
    const contributingFactors: string[] = [];
    const preventionSuggestions: string[] = [];
    const recommendedActions: string[] = [];
    let recoverabilityScore = 0.3; // Base score

    // Analyze primary reason
    switch (lostAnalysis.primary_reason) {
      case 'price_too_high':
        rootCauses.push('Giá cả không cạnh tranh');
        
        if (lostAnalysis.price_difference && lostAnalysis.price_difference > 50000000) {
          contributingFactors.push(`Chênh lệch giá quá lớn: ${(lostAnalysis.price_difference / 1000000).toFixed(1)}M VND`);
          preventionSuggestions.push('Xem xét điều chỉnh giá hoặc tăng giá trị gia tăng (phụ kiện, bảo hiểm, bảo hành)');
        } else {
          contributingFactors.push('Có thể thương lượng được');
          preventionSuggestions.push('Đào tạo sale về kỹ năng thương lượng và tạo giá trị cảm nhận');
          recoverabilityScore += 0.2;
        }
        
        recommendedActions.push('Đưa ra ưu đãi đặc biệt trong vòng 7 ngày');
        break;

      case 'competitor_better_offer':
        rootCauses.push('Đối thủ có đề xuất hấp dẫn hơn');
        
        if (lostAnalysis.competitor_brand) {
          contributingFactors.push(`Chuyển sang ${lostAnalysis.competitor_brand} ${lostAnalysis.competitor_model || ''}`);
          
          // Analyze competitor positioning
          const { data: competitorLosses } = await supabase
            .from('auto_lost_analysis')
            .select('id')
            .eq('tenant_id', tenantId)
            .eq('competitor_brand', lostAnalysis.competitor_brand)
            .gte('lost_date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());
          
          if (competitorLosses && competitorLosses.length >= 3) {
            contributingFactors.push(`Xu hướng: ${competitorLosses.length} khách chuyển sang ${lostAnalysis.competitor_brand} trong 3 tháng`);
            preventionSuggestions.push(`CẢNH BÁO: Phân tích sâu về ${lostAnalysis.competitor_brand} - cần chiến lược đối phó`);
          }
        }
        
        preventionSuggestions.push('Cải thiện value proposition và unique selling points');
        recommendedActions.push('Gọi khách để hiểu rõ điểm mạnh của đối thủ');
        recoverabilityScore += 0.15;
        break;

      case 'changed_mind':
      case 'not_ready':
        rootCauses.push('Khách hàng chưa sẵn sàng mua');
        contributingFactors.push('Có thể do timing hoặc ưu tiên tài chính thay đổi');
        preventionSuggestions.push('Nurturing campaign dài hạn, giữ liên lạc định kỳ');
        recommendedActions.push('Theo dõi và liên hệ lại sau 3-6 tháng');
        recoverabilityScore += 0.3; // High recovery potential
        break;

      case 'bought_elsewhere':
        rootCauses.push('Đã mua xe tại đại lý khác');
        contributingFactors.push('Mất khách hàng hoàn toàn cho kỳ này');
        preventionSuggestions.push('Phân tích quy trình bán hàng để tìm điểm yếu');
        recommendedActions.push('Thu thập feedback chi tiết về trải nghiệm tại đại lý khác');
        recoverabilityScore = 0.05; // Very low recovery
        break;

      case 'poor_service':
        rootCauses.push('Trải nghiệm dịch vụ không tốt');
        contributingFactors.push('Vấn đề nghiêm trọng về chất lượng phục vụ');
        preventionSuggestions.push('ĐÀO TẠO LẠI nhân viên - vấn đề cấp thiết');
        
        // Check if consultant has pattern of losses
        if (lostAnalysis.sales_consultant_id) {
          const { data: consultantLosses } = await supabase
            .from('auto_lost_analysis')
            .select('id')
            .eq('tenant_id', tenantId)
            .eq('sales_consultant_id', lostAnalysis.sales_consultant_id)
            .gte('lost_date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());
          
          if (consultantLosses && consultantLosses.length >= 3) {
            contributingFactors.push(`CẢNH BÁO: Tư vấn viên này đã mất ${consultantLosses.length} khách trong 3 tháng`);
            preventionSuggestions.push('Cần can thiệp coaching hoặc điều chỉnh phân công');
          }
        }
        
        recommendedActions.push('Gọi xin lỗi và đề xuất làm việc với consultant khác');
        recoverabilityScore += 0.25;
        break;

      case 'vehicle_unavailable':
        rootCauses.push('Không có xe sẵn/thời gian giao xe quá lâu');
        contributingFactors.push('Vấn đề về quản lý tồn kho');
        preventionSuggestions.push('Cải thiện dự báo nhu cầu và quản lý inventory');
        recommendedActions.push('Thông báo ngay khi có xe về');
        recoverabilityScore += 0.4; // Good recovery potential
        break;

      default:
        rootCauses.push(lostAnalysis.primary_reason);
        recommendedActions.push('Phân tích chi tiết nguyên nhân');
    }

    // Analyze stage where lost
    switch (lostAnalysis.lost_at_stage) {
      case 'initial_contact':
      case 'qualification':
        contributingFactors.push('Mất khách rất sớm - có thể lead chất lượng thấp');
        preventionSuggestions.push('Cải thiện lead scoring và qualification criteria');
        break;

      case 'needs_analysis':
      case 'consideration':
        contributingFactors.push('Mất trong giai đoạn tư vấn - cần cải thiện discovery process');
        preventionSuggestions.push('Đào tạo kỹ năng khám phá nhu cầu và tư vấn giải pháp');
        break;

      case 'quotation':
      case 'negotiation':
        contributingFactors.push('Mất ở giai đoạn báo giá/thương lượng - vấn đề về giá hoặc điều kiện');
        preventionSuggestions.push('Review pricing strategy và quyền hạn thương lượng của sale');
        break;

      case 'test_drive':
        contributingFactors.push('Mất sau lái thử - trải nghiệm không tốt hoặc xe không đáp ứng kỳ vọng');
        preventionSuggestions.push('Cải thiện quy trình lái thử và follow-up ngay sau test drive');
        break;

      case 'commitment':
      case 'booking':
        contributingFactors.push('Mất ở giai đoạn cam kết - khách đã rất gần chốt đơn');
        preventionSuggestions.push('NGHIÊM TRỌNG: Cần phân tích kỹ và can thiệp ngay');
        recoverabilityScore += 0.2;
        break;
    }

    // Analyze customer feedback sentiment
    if (lostAnalysis.customer_feedback) {
      const feedback = lostAnalysis.customer_feedback.toLowerCase();
      
      if (feedback.includes('thất vọng') || feedback.includes('tệ') || feedback.includes('không hài lòng')) {
        contributingFactors.push('Feedback tiêu cực mạnh - khách hàng rất không hài lòng');
        recoverabilityScore -= 0.1;
      }
      
      if (feedback.includes('suy nghĩ') || feedback.includes('sau này') || feedback.includes('chưa chắc')) {
        contributingFactors.push('Khách vẫn còn cân nhắc - có cơ hội phục hồi');
        recoverabilityScore += 0.15;
      }
    }

    // Find similar cases for learning
    const { data: similarCases } = await supabase
      .from('auto_lost_analysis')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('lost_at_stage', lostAnalysis.lost_at_stage)
      .eq('primary_reason', lostAnalysis.primary_reason)
      .gte('lost_date', new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString());

    const similarCasesCount = similarCases?.length || 0;

    if (similarCasesCount >= 5) {
      contributingFactors.push(`Pattern detected: ${similarCasesCount} trường hợp tương tự trong 6 tháng`);
      preventionSuggestions.push('KHẨN CẤP: Vấn đề hệ thống - cần thay đổi quy trình');
    }

    // Cap recoverability score
    recoverabilityScore = Math.min(Math.max(recoverabilityScore, 0), 1);

    return {
      rootCauses,
      contributingFactors,
      preventionSuggestions,
      similarCases: similarCasesCount,
      recoverabilityScore,
      recommendedActions,
    };
  }

  /**
   * Create recovery action for recoverable cases
   */
  private static async createRecoveryAction(
    tenantId: string,
    lostAnalysis: LostAnalysis,
    analysis: AIAnalysisResult
  ): Promise<void> {
    const supabase = getPrimaryClient();

    const priorityMap: Record<string, 'critical' | 'high' | 'medium' | 'low'> = {
      '0.8': 'critical',
      '0.6': 'high',
      '0.4': 'medium',
      '0.2': 'low',
    };

    const priority = analysis.recoverabilityScore >= 0.8 ? 'critical' :
                     analysis.recoverabilityScore >= 0.6 ? 'high' :
                     analysis.recoverabilityScore >= 0.4 ? 'medium' : 'low';

    await supabase.from('auto_next_best_actions').insert({
      tenant_id: tenantId,
      customer_id: lostAnalysis.customer_id,
      journey_id: lostAnalysis.journey_id,
      action_type: 'recover_lost_customer',
      action_priority: priority,
      action_title: `Cơ hội phục hồi khách hàng (${Math.round(analysis.recoverabilityScore * 100)}%)`,
      action_description: `Khách mất tại giai đoạn "${lostAnalysis.lost_at_stage}" vì "${lostAnalysis.primary_reason}". AI đánh giá có ${Math.round(analysis.recoverabilityScore * 100)}% khả năng phục hồi. Hành động đề xuất: ${analysis.recommendedActions.join(', ')}`,
      reason: `Recovery opportunity identified by AI. Root causes: ${analysis.rootCauses.join('; ')}`,
      confidence_score: analysis.recoverabilityScore,
      data_points: {
        lost_analysis_id: lostAnalysis.id,
        lost_reason: lostAnalysis.primary_reason,
        root_causes: analysis.rootCauses,
        recommended_actions: analysis.recommendedActions,
      },
      assigned_to: lostAnalysis.sales_consultant_id,
      status: 'pending',
      valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  /**
   * Get lost opportunity analytics
   */
  static async getLostOpportunityAnalytics(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalLost: number;
    byStage: Record<string, number>;
    byReason: Record<string, number>;
    topCompetitors: Array<{ brand: string; count: number }>;
    averageRecoverabilityScore: number;
    recoveryAttempts: number;
    successfulRecoveries: number;
  }> {
    const supabase = getPrimaryClient();

    const { data: lostRecords, error } = await supabase
      .from('auto_lost_analysis')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('lost_date', startDate.toISOString().split('T')[0])
      .lte('lost_date', endDate.toISOString().split('T')[0]);

    if (error) {
      throw new Error(`Failed to get analytics: ${error.message}`);
    }

    if (!lostRecords || lostRecords.length === 0) {
      return {
        totalLost: 0,
        byStage: {},
        byReason: {},
        topCompetitors: [],
        averageRecoverabilityScore: 0,
        recoveryAttempts: 0,
        successfulRecoveries: 0,
      };
    }

    // Group by stage
    const byStage: Record<string, number> = {};
    for (const record of lostRecords) {
      byStage[record.lost_at_stage] = (byStage[record.lost_at_stage] || 0) + 1;
    }

    // Group by reason
    const byReason: Record<string, number> = {};
    for (const record of lostRecords) {
      byReason[record.primary_reason] = (byReason[record.primary_reason] || 0) + 1;
    }

    // Top competitors
    const competitorCounts: Record<string, number> = {};
    for (const record of lostRecords) {
      if (record.competitor_brand) {
        competitorCounts[record.competitor_brand] = (competitorCounts[record.competitor_brand] || 0) + 1;
      }
    }
    const topCompetitors = Object.entries(competitorCounts)
      .map(([brand, count]) => ({ brand, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Average recoverability
    const analyzedRecords = lostRecords.filter((r) => r.ai_analyzed && r.ai_analysis_result);
    const totalRecoverability = analyzedRecords.reduce(
      (sum, r) => sum + ((r.ai_analysis_result as AIAnalysisRecord | null)?.recoverabilityScore ?? 0),
      0
    );
    const averageRecoverabilityScore = analyzedRecords.length > 0
      ? totalRecoverability / analyzedRecords.length
      : 0;

    // Recovery stats
    const recoveryAttempts = lostRecords.filter((r) => r.recovery_attempted).length;
    const successfulRecoveries = lostRecords.filter((r) => r.recovery_outcome === 'recovered').length;

    return {
      totalLost: lostRecords.length,
      byStage,
      byReason,
      topCompetitors,
      averageRecoverabilityScore: Math.round(averageRecoverabilityScore * 100) / 100,
      recoveryAttempts,
      successfulRecoveries,
    };
  }

  /**
   * Get prevention insights
   */
  static async getPreventionInsights(
    tenantId: string,
    period: 'last_30_days' | 'last_90_days' | 'last_year' = 'last_90_days'
  ): Promise<{
    criticalIssues: string[];
    processImprovements: string[];
    trainingNeeds: string[];
    competitiveThreats: string[];
  }> {
    const supabase = getPrimaryClient();

    const daysMap = {
      last_30_days: 30,
      last_90_days: 90,
      last_year: 365,
    };

    const startDate = new Date(Date.now() - daysMap[period] * 24 * 60 * 60 * 1000);

    const { data: lostRecords } = await supabase
      .from('auto_lost_analysis')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('lost_date', startDate.toISOString().split('T')[0])
      .eq('ai_analyzed', true);

    const criticalIssues: Set<string> = new Set();
    const processImprovements: Set<string> = new Set();
    const trainingNeeds: Set<string> = new Set();
    const competitiveThreats: Set<string> = new Set();

    for (const record of lostRecords || []) {
      const suggestions = (record.ai_prevention_suggestions as string[]) || [];
      
      for (const suggestion of suggestions) {
        const lower = suggestion.toLowerCase();
        
        if (lower.includes('khẩn cấp') || lower.includes('nghiêm trọng') || lower.includes('cảnh báo')) {
          criticalIssues.add(suggestion);
        }
        
        if (lower.includes('quy trình') || lower.includes('cải thiện') || lower.includes('process')) {
          processImprovements.add(suggestion);
        }
        
        if (lower.includes('đào tạo') || lower.includes('coaching') || lower.includes('kỹ năng')) {
          trainingNeeds.add(suggestion);
        }
        
        if (lower.includes('đối thủ') || lower.includes('cạnh tranh') || lower.includes('competitor')) {
          competitiveThreats.add(suggestion);
        }
      }
    }

    return {
      criticalIssues: Array.from(criticalIssues),
      processImprovements: Array.from(processImprovements),
      trainingNeeds: Array.from(trainingNeeds),
      competitiveThreats: Array.from(competitiveThreats),
    };
  }
}
