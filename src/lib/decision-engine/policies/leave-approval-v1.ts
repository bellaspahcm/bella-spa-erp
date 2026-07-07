/**
 * Leave Approval Policy v1
 * 
 * Simple leave approval rules based on:
 * - Advance notice (hours until leave)
 * - Leave balance
 * - Attendance violations
 * - Conflicts with existing bookings
 */

import type { Policy } from '../types';

export const leaveApprovalPolicyV1: Policy = {
  id: 'leave-approval-v1',
  version: '1.0.0',
  name: 'Chính sách phê duyệt nghỉ phép',
  description: 'Tự động phê duyệt đơn nghỉ phép dựa trên thời gian báo trước và hồ sơ chuyên cần',
  
  rules: [
    // Rule 1: Tự động phê duyệt nếu báo trước ≥24h + hồ sơ tốt
    {
      id: 'advance-notice-24h',
      priority: 1,
      conditions: {
        type: 'operator',
        operator: 'and',
        conditions: [
          {
            type: 'comparison',
            field: 'leave.hoursNotice',
            operator: '>=',
            value: 24
          },
          {
            type: 'comparison',
            field: 'leave.balance',
            operator: '>',
            value: 0
          },
          {
            type: 'comparison',
            field: 'attendance.violations',
            operator: '==',
            value: 0
          },
          {
            type: 'comparison',
            field: 'context.hasConflict',
            operator: '===',
            value: false
          }
        ]
      },
      action: {
        outcome: 'APPROVE',
        reason: 'Đơn nghỉ phép đạt yêu cầu: báo trước ≥24 giờ, còn số ngày phép, không có vi phạm chuyên cần'
      }
    },
    
    // Rule 2: Tự động từ chối nếu báo trước <24h
    {
      id: 'same-day-reject',
      priority: 2,
      conditions: {
        type: 'comparison',
        field: 'leave.hoursNotice',
        operator: '<',
        value: 24
      },
      action: {
        outcome: 'REJECT',
        reason: 'Đơn nghỉ phép bị từ chối: cần báo trước tối thiểu 24 giờ'
      }
    },
    
    // Rule 3: Tự động từ chối nếu hết số ngày phép
    {
      id: 'no-balance-reject',
      priority: 3,
      conditions: {
        type: 'comparison',
        field: 'leave.balance',
        operator: '<=',
        value: 0
      },
      action: {
        outcome: 'REJECT',
        reason: 'Đơn nghỉ phép bị từ chối: không còn số ngày phép (số dư: 0 ngày)'
      }
    },
    
    // Rule 4: Chuyển quản lý xem xét nếu có ca trùng lịch
    {
      id: 'conflict-escalate',
      priority: 4,
      conditions: {
        type: 'comparison',
        field: 'context.hasConflict',
        operator: '===',
        value: true
      },
      action: {
        outcome: 'ESCALATE',
        reason: 'Cần quản lý xem xét: có ca liệu trình trùng lịch với ngày xin nghỉ, cần điều động KTV thay thế'
      }
    },
    
    // Rule 5: Chuyển quản lý xem xét nếu có vi phạm chuyên cần
    {
      id: 'violations-escalate',
      priority: 5,
      conditions: {
        type: 'comparison',
        field: 'attendance.violations',
        operator: '>',
        value: 0
      },
      action: {
        outcome: 'ESCALATE',
        reason: 'Cần quản lý xem xét: nhân viên có vi phạm chuyên cần (vắng mặt hoặc đi muộn) trong 90 ngày gần đây'
      }
    },
    
    // Rule 6: Mặc định chuyển quản lý (safety fallback)
    {
      id: 'default-escalate',
      priority: 100,
      conditions: {
        type: 'operator',
        operator: 'or',
        conditions: [] // Always false, but catches anything not matched above
      },
      action: {
        outcome: 'ESCALATE',
        reason: 'Cần quản lý xem xét: trường hợp đặc biệt chưa được định nghĩa trong chính sách tự động'
      }
    }
  ]
};
