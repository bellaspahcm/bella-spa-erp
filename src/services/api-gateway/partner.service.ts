/**
 * Partner Management Service - Phase 1
 * 
 * Service layer for managing API partners
 * 
 * Features:
 * - Create/Read/Update/Delete partners
 * - Generate and rotate API keys
 * - Manage scopes and permissions
 * - Track usage statistics
 * 
 * @module services/api-gateway/partner
 * @since 2026-06-17
 */

import { createClient } from '@/lib/supabase/server';
import {
  APIPartner,
  CreateAPIPartnerInput,
  UpdateAPIPartnerInput,
  APIPartnerUsageSummary,
  PartnerType,
  APIScope,
  SCOPE_PRESETS,
  APIError,
} from '@/types/api-gateway';

// ============================================================================
// TYPES
// ============================================================================

export interface ListPartnersParams {
  tenant_id?: string;
  partner_type?: PartnerType;
  is_active?: boolean;
  is_sandbox?: boolean;
  limit?: number;
  offset?: number;
}

export interface PartnerStatistics {
  total_partners: number;
  active_partners: number;
  sandbox_partners: number;
  by_type: Record<PartnerType, number>;
}

// ============================================================================
// PARTNER CRUD OPERATIONS
// ============================================================================

/**
 * Create a new API partner
 * 
 * @param input - Partner creation data
 * @param created_by_user_id - User ID who created the partner
 * @returns Created partner with generated API key
 */
export async function createPartner(
  input: CreateAPIPartnerInput,
  created_by_user_id?: string
): Promise<APIPartner> {
  const supabase = createClient();
  
  try {
    // Generate API key if not provided
    let apiKey = input.api_key;
    
    if (!apiKey) {
      const { data: generatedKey, error: keyError } = await supabase
        .rpc('generate_api_key', { is_test: input.is_sandbox || false });
      
      if (keyError) {
        throw new APIError(
          'SERVER_002',
          'Failed to generate API key',
          keyError,
          500
        );
      }
      
      apiKey = generatedKey;
    }
    
    // Validate scopes
    if (!input.allowed_scopes || input.allowed_scopes.length === 0) {
      throw new APIError(
        'VAL_001',
        'At least one scope is required',
        { provided_scopes: input.allowed_scopes },
        400
      );
    }
    
    // Create partner record
    const partnerData = {
      tenant_id: input.tenant_id,
      partner_name: input.partner_name,
      partner_type: input.partner_type,
      partner_description: input.partner_description,
      contact_email: input.contact_email,
      contact_phone: input.contact_phone,
      
      api_key: apiKey,
      api_secret: input.api_secret,
      
      webhook_url: input.webhook_url,
      webhook_secret: input.webhook_secret,
      webhook_events: input.webhook_events,
      
      allowed_scopes: input.allowed_scopes,
      is_active: input.is_active !== undefined ? input.is_active : true,
      is_sandbox: input.is_sandbox || false,
      
      rate_limit_per_minute: input.rate_limit_per_minute || 100,
      rate_limit_per_day: input.rate_limit_per_day || 5000,
      rate_limit_burst: input.rate_limit_burst || 200,
      
      metadata: input.metadata || {},
      notes: input.notes,
      
      created_by: created_by_user_id,
      updated_by: created_by_user_id,
    };
    
    const { data: partner, error } = await supabase
      .from('api_partners')
      .insert(partnerData)
      .select()
      .single();
    
    if (error) {
      // Check for unique constraint violation (API key already exists)
      if (error.code === '23505') {
        throw new APIError(
          'VAL_003',
          'API key already exists. Please regenerate.',
          error,
          409
        );
      }
      
      throw new APIError(
        'SERVER_002',
        'Failed to create partner',
        error,
        500
      );
    }
    
    return partner as APIPartner;
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    
    throw new APIError(
      'SERVER_001',
      'Unexpected error while creating partner',
      error,
      500
    );
  }
}

/**
 * Get partner by ID
 * 
 * @param partner_id - Partner UUID
 * @param tenant_id - Optional tenant ID for additional security check
 * @returns Partner or null if not found
 */
export async function getPartnerById(
  partner_id: string,
  tenant_id?: string
): Promise<APIPartner | null> {
  const supabase = createClient();
  
  try {
    let query = supabase
      .from('api_partners')
      .select('*')
      .eq('id', partner_id);
    
    // Additional tenant filter for security
    if (tenant_id) {
      query = query.eq('tenant_id', tenant_id);
    }
    
    const { data: partner, error } = await query.single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        return null;
      }
      
      throw new APIError(
        'SERVER_002',
        'Failed to fetch partner',
        error,
        500
      );
    }
    
    return partner as APIPartner;
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    
    throw new APIError(
      'SERVER_001',
      'Unexpected error while fetching partner',
      error,
      500
    );
  }
}

/**
 * Get partner by API key
 * 
 * @param api_key - API key string
 * @returns Partner or null if not found
 */
export async function getPartnerByApiKey(
  api_key: string
): Promise<APIPartner | null> {
  const supabase = createClient();
  
  try {
    const { data: partner, error } = await supabase
      .from('api_partners')
      .select('*')
      .eq('api_key', api_key)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      
      throw new APIError(
        'SERVER_002',
        'Failed to fetch partner by API key',
        error,
        500
      );
    }
    
    return partner as APIPartner;
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    
    throw new APIError(
      'SERVER_001',
      'Unexpected error while fetching partner',
      error,
      500
    );
  }
}

/**
 * List partners with filtering and pagination
 * 
 * @param params - Filter and pagination parameters
 * @returns Partners array and total count
 */
export async function listPartners(
  params: ListPartnersParams = {}
): Promise<{ partners: APIPartner[]; total: number }> {
  const supabase = createClient();
  
  try {
    const {
      tenant_id,
      partner_type,
      is_active,
      is_sandbox,
      limit = 50,
      offset = 0,
    } = params;
    
    let query = supabase
      .from('api_partners')
      .select('*', { count: 'exact' });
    
    // Apply filters
    if (tenant_id) {
      query = query.eq('tenant_id', tenant_id);
    }
    
    if (partner_type) {
      query = query.eq('partner_type', partner_type);
    }
    
    if (is_active !== undefined) {
      query = query.eq('is_active', is_active);
    }
    
    if (is_sandbox !== undefined) {
      query = query.eq('is_sandbox', is_sandbox);
    }
    
    // Pagination
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    const { data: partners, count, error } = await query;
    
    if (error) {
      throw new APIError(
        'SERVER_002',
        'Failed to list partners',
        error,
        500
      );
    }
    
    return {
      partners: partners as APIPartner[],
      total: count || 0,
    };
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    
    throw new APIError(
      'SERVER_001',
      'Unexpected error while listing partners',
      error,
      500
    );
  }
}

/**
 * Update partner
 * 
 * @param partner_id - Partner UUID
 * @param input - Update data
 * @param updated_by_user_id - User ID who updated
 * @returns Updated partner
 */
export async function updatePartner(
  partner_id: string,
  input: UpdateAPIPartnerInput,
  updated_by_user_id?: string
): Promise<APIPartner> {
  const supabase = createClient();
  
  try {
    // Check if partner exists
    const existing = await getPartnerById(partner_id);
    if (!existing) {
      throw new APIError(
        'VAL_001',
        'Partner not found',
        { partner_id },
        404
      );
    }
    
    // Prepare update data
    const updateData: any = {
      ...input,
      updated_by: updated_by_user_id,
      updated_at: new Date().toISOString(),
    };
    
    const { data: partner, error } = await supabase
      .from('api_partners')
      .update(updateData)
      .eq('id', partner_id)
      .select()
      .single();
    
    if (error) {
      throw new APIError(
        'SERVER_002',
        'Failed to update partner',
        error,
        500
      );
    }
    
    return partner as APIPartner;
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    
    throw new APIError(
      'SERVER_001',
      'Unexpected error while updating partner',
      error,
      500
    );
  }
}

/**
 * Delete partner (soft delete by setting is_active = false)
 * 
 * @param partner_id - Partner UUID
 * @returns Success status
 */
export async function deletePartner(
  partner_id: string
): Promise<boolean> {
  const supabase = createClient();
  
  try {
    // Soft delete: set is_active to false
    const { error } = await supabase
      .from('api_partners')
      .update({ is_active: false })
      .eq('id', partner_id);
    
    if (error) {
      throw new APIError(
        'SERVER_002',
        'Failed to delete partner',
        error,
        500
      );
    }
    
    return true;
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    
    throw new APIError(
      'SERVER_001',
      'Unexpected error while deleting partner',
      error,
      500
    );
  }
}


// ============================================================================
// API KEY MANAGEMENT
// ============================================================================

/**
 * Regenerate API key for a partner
 * 
 * **CRITICAL:** Old API key will be invalidated immediately
 * 
 * @param partner_id - Partner UUID
 * @param updated_by_user_id - User ID who regenerated
 * @returns Partner with new API key
 */
export async function regenerateApiKey(
  partner_id: string,
  updated_by_user_id?: string
): Promise<{ partner: APIPartner; new_api_key: string }> {
  const supabase = createClient();
  
  try {
    // Get existing partner
    const existing = await getPartnerById(partner_id);
    if (!existing) {
      throw new APIError(
        'VAL_001',
        'Partner not found',
        { partner_id },
        404
      );
    }
    
    // Generate new API key
    const { data: newApiKey, error: keyError } = await supabase
      .rpc('generate_api_key', { is_test: existing.is_sandbox });
    
    if (keyError) {
      throw new APIError(
        'SERVER_002',
        'Failed to generate new API key',
        keyError,
        500
      );
    }
    
    // Update partner with new key
    const { data: partner, error } = await supabase
      .from('api_partners')
      .update({
        api_key: newApiKey,
        updated_by: updated_by_user_id,
        updated_at: new Date().toISOString(),
        metadata: {
          ...existing.metadata,
          api_key_regenerated_at: new Date().toISOString(),
          previous_key_rotated: true,
        },
      })
      .eq('id', partner_id)
      .select()
      .single();
    
    if (error) {
      throw new APIError(
        'SERVER_002',
        'Failed to update partner with new API key',
        error,
        500
      );
    }
    
    return {
      partner: partner as APIPartner,
      new_api_key: newApiKey,
    };
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    
    throw new APIError(
      'SERVER_001',
      'Unexpected error while regenerating API key',
      error,
      500
    );
  }
}

// ============================================================================
// SCOPE MANAGEMENT
// ============================================================================

/**
 * Add scopes to partner
 * 
 * @param partner_id - Partner UUID
 * @param scopes - Array of scopes to add
 * @returns Updated partner
 */
export async function addScopes(
  partner_id: string,
  scopes: APIScope[]
): Promise<APIPartner> {
  const supabase = createClient();
  
  try {
    const existing = await getPartnerById(partner_id);
    if (!existing) {
      throw new APIError(
        'VAL_001',
        'Partner not found',
        { partner_id },
        404
      );
    }
    
    // Merge scopes (avoid duplicates)
    const currentScopes = new Set(existing.allowed_scopes);
    scopes.forEach(scope => currentScopes.add(scope));
    
    const updatedScopes = Array.from(currentScopes);
    
    const { data: partner, error } = await supabase
      .from('api_partners')
      .update({ allowed_scopes: updatedScopes })
      .eq('id', partner_id)
      .select()
      .single();
    
    if (error) {
      throw new APIError(
        'SERVER_002',
        'Failed to add scopes',
        error,
        500
      );
    }
    
    return partner as APIPartner;
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    
    throw new APIError(
      'SERVER_001',
      'Unexpected error while adding scopes',
      error,
      500
    );
  }
}

/**
 * Remove scopes from partner
 * 
 * @param partner_id - Partner UUID
 * @param scopes - Array of scopes to remove
 * @returns Updated partner
 */
export async function removeScopes(
  partner_id: string,
  scopes: APIScope[]
): Promise<APIPartner> {
  const supabase = createClient();
  
  try {
    const existing = await getPartnerById(partner_id);
    if (!existing) {
      throw new APIError(
        'VAL_001',
        'Partner not found',
        { partner_id },
        404
      );
    }
    
    // Remove scopes
    const scopesToRemove = new Set(scopes);
    const updatedScopes = existing.allowed_scopes.filter(
      scope => !scopesToRemove.has(scope as APIScope)
    );
    
    // Ensure at least one scope remains
    if (updatedScopes.length === 0) {
      throw new APIError(
        'VAL_001',
        'Cannot remove all scopes. Partner must have at least one scope.',
        { current_scopes: existing.allowed_scopes, scopes_to_remove: scopes },
        400
      );
    }
    
    const { data: partner, error } = await supabase
      .from('api_partners')
      .update({ allowed_scopes: updatedScopes })
      .eq('id', partner_id)
      .select()
      .single();
    
    if (error) {
      throw new APIError(
        'SERVER_002',
        'Failed to remove scopes',
        error,
        500
      );
    }
    
    return partner as APIPartner;
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    
    throw new APIError(
      'SERVER_001',
      'Unexpected error while removing scopes',
      error,
      500
    );
  }
}

/**
 * Apply scope preset to partner
 * 
 * @param partner_id - Partner UUID
 * @param preset - Preset name (e.g., 'pos_integration', 'payment_gateway')
 * @returns Updated partner
 */
export async function applySecurePreset(
  partner_id: string,
  preset: keyof typeof SCOPE_PRESETS
): Promise<APIPartner> {
  const scopes = SCOPE_PRESETS[preset];
  
  if (!scopes) {
    throw new APIError(
      'VAL_001',
      `Invalid preset: ${preset}`,
      { available_presets: Object.keys(SCOPE_PRESETS) },
      400
    );
  }
  
  const supabase = createClient();
  
  try {
    const { data: partner, error } = await supabase
      .from('api_partners')
      .update({
        allowed_scopes: scopes,
        metadata: {
          scope_preset_applied: preset,
          scope_preset_applied_at: new Date().toISOString(),
        },
      })
      .eq('id', partner_id)
      .select()
      .single();
    
    if (error) {
      throw new APIError(
        'SERVER_002',
        'Failed to apply scope preset',
        error,
        500
      );
    }
    
    return partner as APIPartner;
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    
    throw new APIError(
      'SERVER_001',
      'Unexpected error while applying scope preset',
      error,
      500
    );
  }
}

// ============================================================================
// STATISTICS & ANALYTICS
// ============================================================================

/**
 * Get partner usage statistics
 * 
 * @param partner_id - Partner UUID
 * @returns Usage statistics from view
 */
export async function getPartnerUsageStats(
  partner_id: string
): Promise<APIPartnerUsageSummary | null> {
  const supabase = createClient();
  
  try {
    const { data: stats, error } = await supabase
      .from('api_partner_usage_summary')
      .select('*')
      .eq('partner_id', partner_id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      
      throw new APIError(
        'SERVER_002',
        'Failed to fetch usage statistics',
        error,
        500
      );
    }
    
    return stats as APIPartnerUsageSummary;
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    
    throw new APIError(
      'SERVER_001',
      'Unexpected error while fetching usage statistics',
      error,
      500
    );
  }
}

/**
 * Get tenant-wide partner statistics
 * 
 * @param tenant_id - Tenant UUID
 * @returns Aggregated statistics
 */
export async function getTenantPartnerStats(
  tenant_id: string
): Promise<PartnerStatistics> {
  const supabase = createClient();
  
  try {
    const { data: partners, error } = await supabase
      .from('api_partners')
      .select('partner_type, is_active, is_sandbox')
      .eq('tenant_id', tenant_id);
    
    if (error) {
      throw new APIError(
        'SERVER_002',
        'Failed to fetch partner statistics',
        error,
        500
      );
    }
    
    // Aggregate statistics
    const stats: PartnerStatistics = {
      total_partners: partners.length,
      active_partners: partners.filter(p => p.is_active).length,
      sandbox_partners: partners.filter(p => p.is_sandbox).length,
      by_type: {} as Record<PartnerType, number>,
    };
    
    // Count by type
    partners.forEach(partner => {
      const type = partner.partner_type as PartnerType;
      stats.by_type[type] = (stats.by_type[type] || 0) + 1;
    });
    
    return stats;
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    
    throw new APIError(
      'SERVER_001',
      'Unexpected error while fetching statistics',
      error,
      500
    );
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Validate API key format
 * 
 * @param api_key - API key string
 * @returns Validation result
 */
export function validateApiKeyFormat(api_key: string): {
  valid: boolean;
  is_test: boolean;
  error?: string;
} {
  if (!api_key) {
    return { valid: false, is_test: false, error: 'API key is empty' };
  }
  
  const testKeyPattern = /^pk_test_[A-Za-z0-9_-]+$/;
  const liveKeyPattern = /^pk_live_[A-Za-z0-9_-]+$/;
  
  if (testKeyPattern.test(api_key)) {
    return { valid: true, is_test: true };
  }
  
  if (liveKeyPattern.test(api_key)) {
    return { valid: true, is_test: false };
  }
  
  return {
    valid: false,
    is_test: false,
    error: 'API key must match format: pk_live_... or pk_test_...',
  };
}

/**
 * Check if partner is allowed to use sandbox mode
 * 
 * @param partner - Partner object
 * @returns True if sandbox is available
 */
export function isSandboxAvailable(partner: APIPartner): boolean {
  return partner.is_sandbox || partner.api_key.startsWith('pk_test_');
}

