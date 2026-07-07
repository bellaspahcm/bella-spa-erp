/**
 * Booking Capacity Policy v1
 * 
 * Kiểm tra khả năng đặt session mới dựa trên:
 * - Booking capacity (completed vs total sessions)
 * - KTV availability (concurrent session check)
 * - Resource availability (room, equipment)
 * - Time slot conflicts
 * 
 * Sprint 3: Validate Policy Model
 * Goal: Prove policy-as-data works for resource constraint problems
 */

import type { Policy } from '../types';

export const bookingCapacityPolicyV1: Policy = {
  id: 'booking-capacity-v1',
  version: '1.0.0',
  name: 'Chính sách kiểm tra khả năng đặt lịch',
  description: 'Tự động kiểm tra khả năng đặt session mới dựa trên capacity và resource availability',
  
  rules: [
    // Rule 1: Booking đã hết số session
    {
      id: 'booking-exhausted',
      priority: 1,
      conditions: {
        type: 'comparison',
        field: 'booking.remainingSessions',
        operator: '<=',
        value: 0
      },
      action: {
        outcome: 'FULL',
        reason: 'Booking đã hết số session (đã hoàn thành đủ số buổi trong gói)'
      }
    },
    
    // Rule 2: Booking không active
    {
      id: 'booking-inactive',
      priority: 2,
      conditions: {
        type: 'comparison',
        field: 'booking.isActive',
        operator: '===',
        value: false
      },
      action: {
        outcome: 'FULL',
        reason: 'Booking không còn active (đã hủy hoặc hoàn thành)'
      }
    },
    
    // Rule 3: KTV đang có session trùng giờ
    {
      id: 'ktv-concurrent-session',
      priority: 3,
      conditions: {
        type: 'comparison',
        field: 'ktv.hasConcurrentSession',
        operator: '===',
        value: true
      },
      action: {
        outcome: 'FULL',
        reason: 'KTV đã có session khác trong cùng khung giờ này'
      }
    },
    
    // Rule 4: Resource không available → escalate (có thể điều chỉnh)
    {
      id: 'resource-unavailable-escalate',
      priority: 4,
      conditions: {
        type: 'operator',
        operator: 'or',
        conditions: [
          {
            type: 'comparison',
            field: 'resource.roomAvailable',
            operator: '===',
            value: false
          },
          {
            type: 'comparison',
            field: 'resource.equipmentAvailable',
            operator: '===',
            value: false
          }
        ]
      },
      action: {
        outcome: 'ESCALATE',
        reason: 'Phòng hoặc thiết bị không sẵn sàng, cần quản lý xác nhận và điều chỉnh'
      }
    },
    
    // Rule 5: Time slot conflict → escalate
    {
      id: 'time-conflict-escalate',
      priority: 5,
      conditions: {
        type: 'comparison',
        field: 'time.hasConflict',
        operator: '===',
        value: true
      },
      action: {
        outcome: 'ESCALATE',
        reason: 'Khung giờ này có xung đột với session khác, cần quản lý xem xét'
      }
    },
    
    // Rule 6: Tất cả điều kiện đạt → BOOKABLE
    {
      id: 'booking-available',
      priority: 6,
      conditions: {
        type: 'operator',
        operator: 'and',
        conditions: [
          {
            type: 'comparison',
            field: 'booking.remainingSessions',
            operator: '>',
            value: 0
          },
          {
            type: 'comparison',
            field: 'booking.isActive',
            operator: '===',
            value: true
          },
          {
            type: 'comparison',
            field: 'ktv.hasConcurrentSession',
            operator: '===',
            value: false
          },
          {
            type: 'comparison',
            field: 'resource.roomAvailable',
            operator: '===',
            value: true
          },
          {
            type: 'comparison',
            field: 'resource.equipmentAvailable',
            operator: '===',
            value: true
          },
          {
            type: 'comparison',
            field: 'time.hasConflict',
            operator: '===',
            value: false
          }
        ]
      },
      action: {
        outcome: 'BOOKABLE',
        reason: 'Có thể đặt session: còn slot, KTV rảnh, resource sẵn sàng, không xung đột thời gian'
      }
    },
    
    // Rule 7: Default fallback → ESCALATE
    {
      id: 'default-escalate',
      priority: 100,
      conditions: {
        type: 'operator',
        operator: 'or',
        conditions: []
      },
      action: {
        outcome: 'ESCALATE',
        reason: 'Trường hợp đặc biệt chưa được định nghĩa, cần quản lý xem xét'
      }
    }
  ]
};
