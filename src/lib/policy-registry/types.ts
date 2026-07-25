/**
 * Policy Registry Types
 * 
 * Defines metadata and interfaces for the Policy Registry system.
 * Registry allows discovering, registering, and managing policies dynamically.
 */

/**
 * Policy Metadata
 * 
 * Describes a policy's identity, classification, and lifecycle.
 */
export interface PolicyMetadata {
  // ═══════════════════════════════════════════════════════════════
  // IDENTITY
  // ═══════════════════════════════════════════════════════════════
  
  /** Unique identifier (e.g., 'base-salary-v1', 'booking-eligibility-v2') */
  id: string;
  
  /** Human-readable name */
  name: string;
  
  /** Semantic version (e.g., '1.2.0') */
  version: string;
  
  // ═══════════════════════════════════════════════════════════════
  // CLASSIFICATION
  // ═══════════════════════════════════════════════════════════════
  
  /** Business domain (e.g., 'payroll', 'booking', 'procurement', 'hospital') */
  domain: string;
  
  /** Policy category (e.g., 'reward', 'penalty', 'validation', 'approval') */
  category: 
    | 'reward'
    | 'penalty'
    | 'multiplier'
    | 'incentive'
    | 'constraint'
    | 'eligibility'
    | 'recommendation'
    | 'approval'
    | 'validation'
    | 'escalation'
    | 'other';
  
  /** Searchable tags */
  tags: string[];
  
  // ═══════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════════════
  
  /** Current status */
  status: 'active' | 'deprecated' | 'experimental';
  
  /** Creation timestamp (ISO 8601) */
  createdAt: string;
  
  /** Last update timestamp (ISO 8601) */
  updatedAt: string;
  
  /** Owner/maintainer (e.g., 'bella-core', 'spa-team', 'partner-xyz') */
  owner: string;
  
  // ═══════════════════════════════════════════════════════════════
  // TECHNICAL
  // ═══════════════════════════════════════════════════════════════
  
  /** Decision type this policy handles (e.g., 'base-salary-eligibility') */
  decisionType: string;
  
  /** Policy class name (for instantiation) */
  className: string;
  
  /** Policy dependencies (other policy IDs required) */
  dependencies?: string[];
  
  // ═══════════════════════════════════════════════════════════════
  // DOCUMENTATION
  // ═══════════════════════════════════════════════════════════════
  
  /** Short description */
  description: string;
  
  /** Change log / version history */
  changeLog?: string;
}

/**
 * Registered Policy
 * 
 * Combines policy instance with its metadata.
 */
export interface RegisteredPolicy {
  /** Policy metadata */
  metadata: PolicyMetadata;
  
  /** Policy instance (the actual policy class) */
  policy: unknown; // Using unknown to allow flexibility across different policy types
  
  /** Registration timestamp */
  registeredAt: string;
}

/**
 * Policy Query Filters
 * 
 * Used to filter/search policies in the registry.
 */
export interface PolicyQueryFilter {
  /** Filter by domain */
  domain?: string;
  
  /** Filter by category */
  category?: PolicyMetadata['category'];
  
  /** Filter by tags (all tags must match) */
  tags?: string[];
  
  /** Filter by status */
  status?: PolicyMetadata['status'];
  
  /** Search by name (partial match) */
  search?: string;
}

/**
 * Policy Registration Options
 * 
 * Options when registering a new policy.
 */
export interface PolicyRegistrationOptions {
  /** Override auto-generated ID */
  id?: string;
  
  /** Override auto-detected metadata */
  metadata?: Partial<PolicyMetadata>;
  
  /** Force registration even if policy already exists */
  force?: boolean;
}

/**
 * Registry Statistics
 * 
 * Summary of policies in the registry.
 */
export interface RegistryStatistics {
  /** Total number of policies */
  totalPolicies: number;
  
  /** Policies by domain */
  byDomain: Record<string, number>;
  
  /** Policies by category */
  byCategory: Record<string, number>;
  
  /** Policies by status */
  byStatus: Record<PolicyMetadata['status'], number>;
}
