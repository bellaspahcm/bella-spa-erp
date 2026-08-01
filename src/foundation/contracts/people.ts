/**
 * @module foundation/contracts/people
 *
 * People Directory Foundation Contracts for Bella EIP.
 *
 * Design principles:
 * - People Directory is NOT HR. It manages "who exists" — not their employment data.
 *   HR attaches Contract, Salary, Attendance to a Person. People Directory just knows they exist.
 *
 * - AssignableReference is intentionally minimal (id + type + displayName).
 *   Assignment Engine and SLA Engine ONLY need AssignableReference.
 *   They must never import HR to get a person's name.
 *
 * - Full PersonProfile is fetched separately via PeopleQueryService.getProfile().
 *   This means if a person changes their display name, ALL systems reflect it automatically
 *   because they never stored the name — only the ID.
 *
 * - A "Person" can be an Employee, Broker, Agency, Partner, or Consultant.
 *   Real Estate needs to assign Leads to all of these — not just Employees.
 *   If AssignableType lived inside HR, the Assignment Engine would be locked to HR concepts.
 *
 * @layer Foundation
 * @see src/foundation/contracts/services.ts for PeopleQueryService interface
 */

// ─── Assignable Type ─────────────────────────────────────────────────────────

/**
 * All person types that can receive assignments in Bella EIP.
 *
 * Key insight: Assignment Engine works with AssignableType, not EmploymentType.
 * This allows Real Estate to assign Leads to Brokers and Agencies
 * without those entities having HR records.
 */
export type AssignableType =
  | 'employee'      // Nhân viên chính thức (có HR record)
  | 'broker'        // Môi giới bên ngoài (không có HR record)
  | 'agency'        // Đại lý (F1, F2) — có thể là tổ chức
  | 'partner'       // Đối tác chiến lược
  | 'consultant'    // Tư vấn độc lập
  | 'contractor';   // Nhân sự hợp đồng ngắn hạn / thời vụ

// ─── Assignable Reference ────────────────────────────────────────────────────

/**
 * The minimal identity of a person that can receive an assignment.
 *
 * This is what Assignment Engine, SLA Engine, and Notification Engine work with.
 * They do not need salary, BHXH, contract, or attendance data.
 *
 * Rule: Never store `displayName` in assignment records.
 * Always resolve via PeopleQueryService.getAssignable(id).
 * This prevents stale names in audit logs.
 *
 * @example
 * // Good — store only ID + type
 * lead.currentAssigneeId = 'broker-abc';
 * lead.currentAssigneeType = 'broker';
 *
 * // Bad — storing name creates drift
 * lead.currentAssigneeName = 'Nguyễn Văn A'; // ❌ may become stale
 */
export interface AssignableReference {
  /** Stable identifier. Never changes even if person's displayName changes. */
  id: string;
  type: AssignableType;
  /**
   * Human-readable name for display purposes only.
   * Fetched live from PeopleQueryService — not persisted in foreign records.
   */
  displayName: string;
}

// ─── Person Profile ──────────────────────────────────────────────────────────

/**
 * Extended profile data for a person.
 * Fetched only when UI or notification needs full contact details.
 *
 * Consumers: Notification Hub, Profile Page, Admin UI.
 * NOT consumed by: Assignment Engine, SLA Engine, Rotation Engine.
 */
export interface PersonProfile {
  id: string;
  type: AssignableType;
  email?: string;
  phone?: string;
  avatar?: string;
  /** IDs of OrgUnits this person currently belongs to */
  orgUnitIds?: string[];
  /** Tenant-specific extension fields */
  metadata?: Record<string, unknown>;
}

// ─── Availability Hint ───────────────────────────────────────────────────────

/**
 * Runtime availability state for an assignable person.
 * Computed by AssignmentQueryService — aggregates HR leave, quota, and SLA data.
 *
 * Consumers: Assignment Engine (for eligibility filtering).
 * This is computed data, not stored in People Directory.
 */
export interface AssignableAvailability {
  assignableId: string;
  isOnLeave: boolean;
  isOverQuota: boolean;
  currentAssignmentCount: number;
  slaBreachCount: number;
  /** ISO timestamp of last assignment received */
  lastAssignedAt?: string;
}
