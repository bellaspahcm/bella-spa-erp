/**
 * Procurement Domain Types
 * 
 * Universal procurement types that work across industries:
 * - Manufacturing (raw materials, components)
 * - Retail (merchandise, inventory)
 * - Construction (materials, equipment)
 * - IT (hardware, software licenses)
 * - Healthcare (medical supplies, equipment)
 * 
 * Same types, different context.
 */

/**
 * Requisition item
 */
export interface ProcurementItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  urgency: 'normal' | 'urgent' | 'critical';
  specification?: string;
}

/**
 * Procurement requisition
 */
export interface ProcurementRequisition {
  id: string;
  requestedBy: string;
  department: string;
  items: ProcurementItem[];
  totalAmount: number;
  urgency: 'normal' | 'urgent' | 'critical';
  justification: string;
  expectedDeliveryDate: string;
  submittedDate: string;
}

/**
 * Budget information
 */
export interface BudgetInfo {
  department: string;
  allocated: number;
  spent: number;
  remaining: number;
  period: string; // e.g., "2026-Q2"
}

/**
 * Vendor information
 */
export interface VendorInfo {
  id: string;
  name: string;
  rating: number; // 1-5 stars
  certifications: string[];
  paymentTerms: string;
  leadTimeDays: number;
  approved: boolean;
}

/**
 * Approval chain configuration
 */
export interface ApprovalChain {
  manager: { name: string; threshold: number }; // < 10M
  director: { name: string; threshold: number }; // < 50M
  cfo: { name: string; threshold: number }; // < 200M
  ceo: { name: string; threshold: number }; // >= 200M
}

/**
 * Procurement rules
 */
export interface ProcurementRules {
  maxAmountWithoutApproval: number;
  requiresMultipleQuotes: boolean;
  multipleQuotesThreshold: number;
  preferredVendorsOnly: boolean;
  maxRejections: number; // Before auto-escalation
}

/**
 * Decision Context for Procurement Process
 */
export interface ProcurementDecisionContext {
  requisition: ProcurementRequisition;
  budget: BudgetInfo;
  vendor: VendorInfo;
  approvalChain: ApprovalChain;
  rules: ProcurementRules;
  metadata?: Record<string, any>;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  reason: string;
  validationErrors: string[];
  budgetCheck: {
    passed: boolean;
    available: number;
    required: number;
  };
  vendorCheck: {
    passed: boolean;
    approved: boolean;
    rating: number;
  };
  itemsCheck: {
    passed: boolean;
    issues: string[];
  };
  matchedRules: string[];
}

/**
 * Approval routing result
 */
export interface ApprovalRoutingResult {
  requiredApprovers: string[];
  autoApproved: boolean;
  approvalLevel: 'manager' | 'director' | 'cfo' | 'ceo' | 'none';
  estimatedApprovalTime: string;
  requiresMultipleQuotes: boolean;
  reason: string;
  matchedRules: string[];
}

/**
 * Escalation result
 */
export interface EscalationResult {
  shouldEscalate: boolean;
  escalationLevel: 'standard' | 'priority' | 'urgent';
  escalateTo: string[];
  reason: string;
  matchedRules: string[];
}

/**
 * Final procurement decision
 */
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
