/**
 * Leave Approval Server Actions with Decision Engine Integration
 */

'use server';

import { evaluateLeaveRequest, getDecisionMessage } from '@/services/leave-decision.service';
import { createClient } from '@/utils/supabase/server';

/**
 * Get automated decision recommendation for leave request.
 * 
 * This provides AI-powered recommendation before manual approval.
 */
export async function getLeaveDecisionRecommendation(leaveId: string) {
  try {
    const supabase = await createClient();
    
    // 1. Fetch leave request
    const { data: leave, error } = await supabase
      .from('staff_leaves')
      .select('*')
      .eq('id', leaveId)
      .single();
    
    if (error || !leave) {
      return {
        success: false,
        error: 'Không tìm thấy đơn nghỉ phép'
      };
    }
    
    // 2. Evaluate using Decision Engine
    const { decision, knowledge, executionTimeMs } = await evaluateLeaveRequest(leave);
    
    // 3. Get human-readable message
    const message = getDecisionMessage(decision);
    
    return {
      success: true,
      recommendation: {
        outcome: decision.outcome,
        explanation: decision.explanation,
        message,
        executionTimeMs,
        knowledge // For debugging/audit
      }
    };
  } catch (error) {
    console.error('[getLeaveDecisionRecommendation] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Lỗi khi đánh giá đơn nghỉ phép'
    };
  }
}
