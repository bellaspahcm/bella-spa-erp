/**
 * Leave Decision Service
 * 
 * Integrates Decision Engine into leave approval workflow.
 * Provides automated decision recommendations based on business rules.
 */

import { RuleReasoner } from '@/lib/decision-engine/RuleReasoner';
import { leaveApprovalPolicyV1 } from '@/lib/decision-engine/policies/leave-approval-v1';
import type { Knowledge, DecisionResult } from '@/lib/decision-engine/types';
import { differenceInHours } from 'date-fns';
import { createClient } from '@/lib/supabase-server';

/**
 * Build knowledge from leave request for decision engine.
 */
export async function buildLeaveKnowledge(leaveRequest: {
  id: string;
  user_id: string;
  leave_date: string;
  leave_type: string;
  reason?: string | null;
}): Promise<Knowledge> {
  const supabase = await createClient();
  
  // 1. Get employee data with leave balance
  const { data: employee } = await supabase
    .from('users')
    .select('id, full_name, role, leave_balance')
    .eq('id', leaveRequest.user_id)
    .single();
  
  // 2. Get leave balance from users table
  const leaveBalance = employee?.leave_balance || 0;
  
  // 3. Get attendance history (check violations in last 90 days)
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  
  const { data: attendanceRecords } = await supabase
    .from('attendance')
    .select('status, date')
    .eq('ktv_id', leaveRequest.user_id)
    .gte('date', ninetyDaysAgo.toISOString().split('T')[0]);
  
  const violations = attendanceRecords?.filter(a => 
    a.status === 'absent' || a.status === 'late'
  ).length || 0;
  
  // 4. Calculate hours until leave
  const hoursUntilLeave = differenceInHours(
    new Date(leaveRequest.leave_date),
    new Date()
  );
  
  // 5. Check conflicts with existing bookings/sessions
  // Query sessions table to check if KTV has assigned sessions on leave date
  const { data: conflictingSessions } = await supabase
    .from('session_logs')
    .select('id, booking_id, session_number, assigned_time')
    .eq('completed_by_ktv_id', leaveRequest.user_id)
    .eq('assigned_date', leaveRequest.leave_date)
    .in('status', ['pending', 'confirmed']);
  
  // Filter by leave type (morning/afternoon/full_day)
  let hasConflict = false;
  if (conflictingSessions && conflictingSessions.length > 0) {
    if (leaveRequest.leave_type === 'full_day') {
      hasConflict = true; // Any session conflicts with full day leave
    } else if (leaveRequest.leave_type === 'morning') {
      // Check if any session is in morning (before 12:00)
      hasConflict = conflictingSessions.some(session => {
        const time = session.assigned_time || '';
        const hour = parseInt(time.split(':')[0] || '0', 10);
        return hour < 12;
      });
    } else if (leaveRequest.leave_type === 'afternoon') {
      // Check if any session is in afternoon (after 12:00)
      hasConflict = conflictingSessions.some(session => {
        const time = session.assigned_time || '';
        const hour = parseInt(time.split(':')[0] || '0', 10);
        return hour >= 12;
      });
    }
  }
  
  // Build knowledge object
  return {
    // Employee knowledge
    'employee.id': employee?.id || leaveRequest.user_id,
    'employee.role': employee?.role || 'ktv',
    
    // Leave knowledge
    'leave.type': leaveRequest.leave_type,
    'leave.hoursNotice': hoursUntilLeave,
    'leave.balance': leaveBalance,
    'leave.reason': leaveRequest.reason || '',
    
    // Attendance knowledge
    'attendance.violations': violations,
    
    // Context knowledge
    'context.hasConflict': hasConflict,
    'context.isWeekend': new Date(leaveRequest.leave_date).getDay() === 0 || 
                         new Date(leaveRequest.leave_date).getDay() === 6
  };
}

/**
 * Evaluate leave request using Decision Engine.
 * Returns automated recommendation.
 */
export async function evaluateLeaveRequest(leaveRequest: {
  id: string;
  user_id: string;
  leave_date: string;
  leave_type: string;
  reason?: string | null;
  created_at?: string;
}): Promise<{
  decision: DecisionResult;
  knowledge: Knowledge;
  executionTimeMs: number;
}> {
  const startTime = performance.now();
  
  // 1. Build knowledge
  const knowledge = await buildLeaveKnowledge(leaveRequest);
  
  // 2. Initialize reasoner
  const reasoner = new RuleReasoner({
    debug: process.env.NODE_ENV !== 'production'
  });
  
  // 3. Evaluate decision
  const decision = reasoner.evaluate(leaveApprovalPolicyV1, knowledge);
  
  const executionTimeMs = performance.now() - startTime;
  
  // 4. Log structured telemetry for observability
  console.log('[DecisionEngine]', JSON.stringify({
    timestamp: new Date().toISOString(),
    policy: leaveApprovalPolicyV1.id,
    policyVersion: leaveApprovalPolicyV1.version,
    outcome: decision.outcome,
    reason: decision.explanation,
    requestId: leaveRequest.id,
    employeeId: leaveRequest.user_id,
    durationMs: Math.round(executionTimeMs),
    knowledge: {
      hoursNotice: knowledge['leave.hoursNotice'],
      balance: knowledge['leave.balance'],
      violations: knowledge['attendance.violations'],
      hasConflict: knowledge['context.hasConflict']
    }
  }));
  
  return {
    decision,
    knowledge,
    executionTimeMs
  };
}

/**
 * Get human-readable decision message for UI.
 */
export function getDecisionMessage(decision: DecisionResult): {
  title: string;
  description: string;
  color: 'green' | 'red' | 'yellow';
} {
  switch (decision.outcome) {
    case 'APPROVE':
      return {
        title: '✅ Khuyến nghị PHÊ DUYỆT',
        description: decision.explanation || 'Đơn nghỉ phép đáp ứng đầy đủ điều kiện tự động phê duyệt',
        color: 'green'
      };
    case 'REJECT':
      return {
        title: '❌ Khuyến nghị TỪ CHỐI',
        description: decision.explanation || 'Đơn nghỉ phép không đáp ứng điều kiện phê duyệt',
        color: 'red'
      };
    case 'ESCALATE':
      return {
        title: '⚠️ Cần xem xét thủ công',
        description: decision.explanation || 'Đơn nghỉ phép cần người quản lý xem xét và quyết định',
        color: 'yellow'
      };
    default:
      return {
        title: '⚠️ Không xác định',
        description: 'Không thể đưa ra khuyến nghị tự động',
        color: 'yellow'
      };
  }
}
