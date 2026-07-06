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
    const supabase = await createClient();
    
    // 1. Fetch leave request
    const { data: leave, error } = await supabase
      .from('staff_leaves')
      .select('*')
      .eq('id', leaveId)
      .single();
    
    if (error || !leave) {
      return {
        error: true,
        message: 'Không tìm thấy đơn nghỉ phép'
      };
    }
    
    // 2. Evaluate using Decision Engine
    const { decision, knowledge, executionTimeMs } = await evaluateLeaveRequest(leave);
    
    // 3. Get human-readable message
    const message = getDecisionMessage(decision);
    
    return {
      outcome: decision.outcome,
      explanation: decision.explanation,
      executionTime: Math.round(executionTimeMs),
      policyId: 'leave-approval-v1',
      policyVersion: '1.0.0',
      message,
      knowledge // For debugging/audit
    };
  } catch (error) {
    console.error('[getLeaveDecisionRecommendation] Error:', error);
    return {
      error: true,
      message: error instanceof Error ? error.message : 'Lỗi khi đánh giá đơn nghỉ phép'
    };
  }
}
