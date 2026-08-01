/**
 * @module foundation/contracts/organization
 *
 * Organization Foundation Contracts for Bella EIP.
 *
 * Design principles:
 * - Organization is a GRAPH, not a rigid tree.
 *   A Sale can belong to Branch A, sell Project B, and join Task Force C simultaneously.
 *   Hard-coding a Company→Branch→Department→Team tree would break Matrix org structures.
 *
 * - OrgUnit = node. OrgRelationship = edge.
 *   All structural queries traverse the graph via relationships.
 *
 * - Foundation contracts MUST NOT import from Capabilities or Business Modules.
 *   Dependency direction: Shared Contracts → Foundation → Capabilities → Modules.
 *
 * @layer Foundation
 * @see src/foundation/contracts/services.ts for OrgQueryService interface
 */

// ─── Org Unit ────────────────────────────────────────────────────────────────

/**
 * All supported organization unit types.
 * Extensible — new types can be added without breaking existing logic.
 */
export type OrgUnitType =
  | 'company'      // Công ty mẹ / pháp nhân
  | 'region'       // Miền / vùng (TP.HCM, Hà Nội...)
  | 'branch'       // Chi nhánh
  | 'department'   // Phòng ban
  | 'team'         // Team bán hàng / kỹ thuật
  | 'project'      // Dự án (Project bất động sản — org context, not product)
  | 'task_force'   // Nhóm công tác tạm thời
  | 'committee';   // Hội đồng / ban

/**
 * A node in the Organization graph.
 * Referenced by ID in all downstream systems (Lead, Approval, Payroll).
 */
export interface OrgUnitRef {
  id: string;
  tenantId: string;
  type: OrgUnitType;
  name: string;
  /** Short identifier, e.g. "HCM-Q1", "TEAM-LUXURY" */
  code?: string;
  /** Primary parent for tree-style display. Not the only relationship. */
  parentId?: string;
  /** Arbitrary metadata for tenant-specific extensions */
  metadata?: Record<string, unknown>;
}

// ─── Org Relationships ───────────────────────────────────────────────────────

/**
 * Relationship types between org units or between a person and an org unit.
 */
export type OrgRelationshipType =
  | 'belongs_to'        // Unit là con của unit cha (cấu trúc chính)
  | 'manages'           // Unit / Person quản lý unit khác
  | 'participates_in'   // Person tham gia vào unit (Task Force, Project)
  | 'reports_to'        // Person báo cáo trực tiếp đến manager
  | 'collaborates_with';// Quan hệ hợp tác ngang hàng

/**
 * An edge in the Organization graph.
 * Can connect: Unit→Unit, Person→Unit, or Person→Person (for reporting lines).
 * `until` allows temporary relationships (e.g. Task Force ends after project).
 */
export interface OrgRelationship {
  id: string;
  fromId: string;          // OrgUnit.id or AssignableReference.id
  fromType: 'unit' | 'person';
  toId: string;
  toType: 'unit' | 'person';
  type: OrgRelationshipType;
  /** Contextual role in this specific relationship, e.g. "Team Lead" in this task force */
  role?: string;
  since?: string;          // ISO date — when relationship started
  until?: string;          // ISO date — null means ongoing
  metadata?: Record<string, unknown>;
}

// ─── Convenience Refs ────────────────────────────────────────────────────────

/**
 * Lightweight Branch reference used in Lead assignment context.
 * Consumers should use OrgQueryService.getBranch() to resolve this.
 */
export interface BranchRef {
  id: string;
  name: string;
  code?: string;
  regionId?: string;
  tenantId: string;
}

/**
 * Lightweight Team reference.
 * Teams belong to Branches but may span across Projects.
 */
export interface TeamRef {
  id: string;
  name: string;
  branchId: string;
  tenantId: string;
  /** 'sales' | 'support' | 'management' | custom string */
  teamType?: string;
}
