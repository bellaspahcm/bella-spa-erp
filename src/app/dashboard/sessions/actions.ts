/**
 * Leave Approval Server Actions with Decision Engine Integration
 */

'use server';

import { evaluateLeaveRequest, getDecisionMessage } from '@/services/leave-decision.service';
import { createClient } from '@/lib/supabase-server';

/**
 * Get automated decision recommendation for leave request.
 * 
 * This provides AI-powered recommendation before manual approval.
 */
export async function getLeaveDecisionRecommendation(leaveId: string) {
  try {
    console.log('[getLeaveDecisionRecommendation] Starting for leave ID:', leaveId);
    const supabase = await createClient();
    
    // 1. Fetch leave request
    console.log('[getLeaveDecisionRecommendation] Fetching from staff_leaves...');
    const { data: leave, error } = await supabase
      .from('staff_leaves')
      .select('*')
      .eq('id', leaveId)
      .single();
    
    console.log('[getLeaveDecisionRecommendation] Query result:', { leave, error });
    
    if (error) {
      console.error('[getLeaveDecisionRecommendation] Supabase error:', error);
      return {
        error: true,
        message: `Database error: ${error.message || 'Unknown'}`
      };
    }
    
    if (!leave) {
      console.error('[getLeaveDecisionRecommendation] Leave not found');
      return {
        error: true,
        message: 'Không tìm thấy đơn nghỉ phép'
      };
    }
    
    // 2. Evaluate using Decision Engine
    console.log('[getLeaveDecisionRecommendation] Evaluating with Decision Engine...');
    const { decision, knowledge, executionTimeMs } = await evaluateLeaveRequest(leave);
    console.log('[getLeaveDecisionRecommendation] Evaluation complete:', { decision, executionTimeMs });
    
    // 3. Get human-readable message
    const message = getDecisionMessage(decision);
    
    const result = {
      outcome: decision.outcome,
      explanation: decision.explanation,
      executionTime: Math.round(executionTimeMs),
      policyId: 'leave-approval-v1',
      policyVersion: '1.0.0',
      message,
      knowledge // For debugging/audit
    };
    
    console.log('[getLeaveDecisionRecommendation] Returning result:', result);
    return result;
  } catch (error) {
    console.error('[getLeaveDecisionRecommendation] Caught error:', error);
    console.error('[getLeaveDecisionRecommendation] Error stack:', error instanceof Error ? error.stack : 'No stack');
    return {
      error: true,
      message: error instanceof Error ? error.message : 'Lỗi khi đánh giá đơn nghỉ phép'
    };
  }
}
