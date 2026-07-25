/**
 * @fileoverview Procurement-specific decision context and result types.
 *
 * These types support the Procurement Business Process pipeline:
 * ValidationPolicy → ApprovalPolicy → EscalationPolicy
 */

import type { DecisionContext } from './decision-context';

// ─── Requisition Item ────────────────────────────────────────────────────────

export interface RequisitionItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  category?: string;
  supplier?: string;
}

// ─── Procurement Decision Context ────────────────────────────────────────────

export interface ProcurementDecisionContext extends DecisionContext {
  /** The procurement requisition being evaluated */
  requisition: {
    id: string;
    title: string;
    requestedBy: string;
    department: string;
    totalAmount: number;
    currency: string;
    urgency: 'low' | 'medium' | 'high' | 'critical';
    category: string;
    items: RequisitionItem[];
    justification?: string;
    requestedDate: string;
  };

  /** Budget information */
  budget?: {
    available: number;
    used: number;
    total: number;
  };

  /** Requester's approval authority */
  requester?: {
    role: string;
    department: string;
    approvalLimit: number;
  };

  /** Approval Chain threshold configurations */
  approvalChain?: {
    manager: { threshold: number; name: string };
    director: { threshold: number; name: string };
    cfo: { threshold: number; name: string };
    ceo: { threshold: number; name: string };
  };

  /** Vendor information */
  vendor?: {
    id: string;
    name: string;
    approved: boolean;
    rating: number;
  };

  /** Rules configuration */
  rules?: {
    maxAmountWithoutApproval?: number;
    requiresMultipleQuotes?: boolean;
    multipleQuotesThreshold?: number;
    maxRejections?: number;
    escalationThresholdDays?: number;
    restrictedCategories?: string[];
    restrictedSuppliers?: string[];
    [key: string]: unknown;
  };
}

// ─── Policy Result Types ──────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  reason: string;
  errors?: string[];
  validationErrors?: string[];
  budgetCheck?: { passed: boolean; available: number; required: number };
  vendorCheck?: { passed: boolean; approved: boolean; rating: number };
  itemsCheck?: { passed: boolean; issues: string[] };
  matchedRules?: string[];
}

export interface ApprovalRoutingResult {
  requiredApprovers: string[];
  autoApproved: boolean;
  estimatedApprovalTime: string;
  reason: string;
  approvalLevel: 'none' | 'team_lead' | 'manager' | 'director' | 'cfo' | 'ceo';
  requiresMultipleQuotes?: boolean;
  matchedRules?: string[];
}

export interface EscalationResult {
  shouldEscalate: boolean;
  reason: string;
  escalateTo?: string | string[];
  escalationDeadline?: string;
  escalationLevel?: 'standard' | 'priority' | 'urgent';
  matchedRules?: string[];
}

// ─── Aggregate Procurement Result ────────────────────────────────────────────

export interface ProcurementResult {
  requisitionId: string;
  valid: boolean;
  requiredApprovers: string[];
  autoApproved: boolean;
  shouldEscalate: boolean;
  estimatedCompletionTime: string;
  status: 'approved' | 'pending_approval' | 'rejected' | 'escalated';
  reason: string;
  components: Array<ValidationResult | ApprovalRoutingResult | EscalationResult>;
  metadata: {
    processName: string;
    processVersion: string;
    executionTime: number;
    policyComposition: string[];
  };
}
