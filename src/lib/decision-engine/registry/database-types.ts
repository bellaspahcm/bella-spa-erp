/**
 * Policy Registry Database Types
 *
 * Minimal Supabase database type definitions for the policy_registry table
 * and related structures. Used when the auto-generated schema types are
 * out-of-sync with the actual database schema.
 *
 * @module lib/decision-engine/registry/database-types
 */

import type { PolicyStatus } from './types';

/**
 * Full policy_registry database row (all columns)
 */
export interface PolicyRegistryDbRow {
  id: string;
  policy_id: string;
  version: string;
  name: string;
  description: string | null;
  status: PolicyStatus;
  category: string | null;
  tenant_id: string | null;
  is_active: boolean;
  parent_version: string | null;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
  published_at: string | null;
  published_by: string | null;
  deprecated_at: string | null;
  archived_at: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  owner_department: string | null;
  business_owner: string | null;
  business_owner_email: string | null;
  technical_owner: string | null;
  technical_owner_email: string | null;
  review_date: string | null;
  effective_date: string | null;
  expire_date: string | null;
  config: unknown;
  metadata: unknown;
  // Statistics columns
  total_decisions: number;
  total_approvals: number;
  total_rejections: number;
  avg_confidence: number;
  last_decision_at: string | null;
}

/**
 * Minimal Supabase Database type for policy_registry table.
 * Allows fully-typed Supabase client without any 'any' generics.
 */
export interface PolicyRegistryDatabase {
  public: {
    Tables: {
      policy_registry: {
        Row: PolicyRegistryDbRow;
        Insert: Partial<PolicyRegistryDbRow>;
        Update: Partial<PolicyRegistryDbRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      increment_column: {
        Args: {
          table_name: string;
          column_names: string[];
          policy_id: string;
          policy_version: string;
          new_avg_confidence?: number;
        };
        Returns: null;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
