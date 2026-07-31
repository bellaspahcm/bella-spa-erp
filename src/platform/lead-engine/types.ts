/**
 * Bella EIP — Enterprise Lead Lifecycle Subsystem Contracts & Types
 * Decoupled domain models for Lead Assignment, SLA, Workflow, Rotation, Rule, and Audit Engines.
 */

export type LeadState =
  | 'unassigned'      // Lead mới tạo, chưa gán Sale
  | 'waiting_accept'  // Đã gán Sale, đang chờ Sale xác nhận nhận lead (Accept SLA)
  | 'in_progress'     // Sale đã bấm "Nhận Lead", đang chăm sóc (Followup SLA)
  | 'converted'       // Đã chốt hợp đồng / Booking thành công (Stop SLA)
  | 'lost'            // Thất bại / Huỷ / Không tiềm năng (Stop SLA)
  | 'archived';       // Đã xoay hết số vòng (Max Rotations Exceeded), chuyển kho hoặc Quản lý

export type LeadOutcome =
  | 'NEW'             // Lead mới tạo
  | 'CONTACTED'       // Đã liên hệ thành công
  | 'NO_ANSWER'       // Gọi không nghe máy (Tiếp tục Followup hoặc Rotate)
  | 'CALL_BACK'       // Hẹn gọi lại sau
  | 'INTERESTED'      // Khách hàng quan tâm cao
  | 'BOOKING'         // Đặt lịch / Cọc thành công (Thành công -> Stop SLA)
  | 'VISIT'           // Đã đến xem nhà / xem spa
  | 'NEGOTIATING'     // Đang thương lượng giá / hợp đồng
  | 'LOST'            // Khách từ chối / Thất bại (Close Lead)
  | 'WRONG_NUMBER'    // Sai số điện thoại (Close / Invalid)
  | 'NOT_INTERESTED'  // Không có nhu cầu
  | 'INVALID'         // Lead rác / Không hợp lệ
  | 'BLACKLIST';      // Số điện thoại phá rối

export interface SLATimer {
  id: string;
  leadId: string;
  stage: 'accept' | 'followup_1' | 'followup_2' | 'followup_custom';
  startTime: string;      // ISO string
  deadlineTime: string;   // ISO string
  isBreached: boolean;
  breachedAt?: string;    // ISO string
  isCompleted: boolean;
  completedAt?: string;   // ISO string
}

export interface RotationRecord {
  id: string;
  leadId: string;
  fromSaleId?: string;
  fromSaleName?: string;
  toSaleId: string;
  toSaleName: string;
  rotationNumber: number; // Vòng xoay thứ mấy (1..MaxRotation)
  reason: 'sla_accept_timeout' | 'sla_followup_timeout' | 'max_attempts_no_answer' | 'manual_supervisor';
  rotatedAt: string;     // ISO string
}

export type AuditEventType =
  | 'lead_created'
  | 'lead_assigned'
  | 'lead_accepted'
  | 'followup_logged'
  | 'sla_timer_started'
  | 'sla_breached'
  | 'lead_rotated'
  | 'lead_converted'
  | 'lead_closed'
  | 'escalated_to_manager';

export interface LeadAuditEvent {
  id: string;
  leadId: string;
  eventType: AuditEventType;
  actorId: string;
  actorName: string;
  description: string;
  metadata?: Record<string, unknown>;
  timestamp: string;      // ISO string
}

export interface LeadRuleConfig {
  acceptWindowMinutes: number;    // Thời gian chờ Sale nhận lead (Default: 30m)
  followup1WindowHours: number;   // Thời gian cho Followup #1 sau nhận lead (Default: 2h)
  followup2WindowHours: number;   // Thời gian cho Followup #2 sau Followup #1 (Default: 24h)
  maxNoAnswerAttempts: number;    // Số lần không nghe máy tối đa trước khi xoay (Default: 2)
  maxRotations: number;           // Số vòng xoay tối đa giữa các Sale (Default: 3)
  reminderBeforeMinutes: number;  // Cảnh báo trước bao nhiêu phút (Default: 10m)
  autoRotateOnTimeout: boolean;   // Tự động xoay lead khi quá hạn SLA (Default: true)
  escalateToManagerOnMaxRotations: boolean; // Chuyển Quản lý khi hết số vòng xoay (Default: true)
}

export interface ManagedLead {
  id: string;
  tenantId: string;
  moduleKey: string;
  fullName: string;
  phone: string;
  email?: string;
  source: string;
  interestedProject?: string;
  budget?: string;
  notes?: string;
  
  // State & SLA Properties
  state: LeadState;
  currentOutcome: LeadOutcome;
  currentSaleId?: string;
  currentSaleName?: string;
  assignedAt?: string;
  acceptedAt?: string;
  noAnswerCount: number;
  rotationCount: number;
  
  activeSLATimer?: SLATimer;
  rotationHistory: RotationRecord[];
  auditTimeline: LeadAuditEvent[];
  createdAt: string;
  updatedAt: string;
}
