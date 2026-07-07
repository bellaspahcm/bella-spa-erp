/**
 * Payroll Configuration Actions
 * 
 * Server actions for managing tenant payroll configurations.
 * Used by Settings UI to load/save provider configs.
 */

'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { KPIConfig, AttendanceConfig, RatingConfig } from '@/types/payroll-config';

// =====================================================
// TYPES
// =====================================================

export type ProviderKey = 'commission' | 'kpi' | 'attendance' | 'rating' | 'bonus' | 'deduction' | 'insurance' | 'tax' | 'advance' | 'position' | 'seniority' | 'shift' | 'overtime';

export interface ProviderConfigResponse<T = any> {
  id: string;
  tenant_id: string;
  provider_key: ProviderKey;
  enabled: boolean;
  strategy: string;
  config: T;
  version: number;
  updated_at: string;
  notes?: string;
}

export interface SaveProviderConfigParams<T = any> {
  tenantId: string;
  providerKey: ProviderKey;
  enabled: boolean;
  strategy: string;
  config: T;
  notes?: string;
}

// =====================================================
// LOAD CONFIGURATION
// =====================================================

/**
 * Load a specific provider configuration for a tenant
 */
export async function loadProviderConfig<T = any>(
  tenantId: string,
  providerKey: ProviderKey
): Promise<{ success: true; data: ProviderConfigResponse<T> } | { success: false; error: string }> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('tenant_payroll_config')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('provider_key', providerKey)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found - return default config
        return {
          success: false,
          error: 'Config not found (no default loaded)'
        };
      }
      throw error;
    }

    return {
      success: true,
      data: data as ProviderConfigResponse<T>
    };
  } catch (error: any) {
    console.error('Error loading provider config:', error);
    return {
      success: false,
      error: error.message || 'Failed to load config'
    };
  }
}

/**
 * Load all provider configurations for a tenant
 */
export async function loadAllProviderConfigs(
  tenantId: string
): Promise<{ success: true; data: ProviderConfigResponse[] } | { success: false; error: string }> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('tenant_payroll_config')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('provider_key');

    if (error) throw error;

    return {
      success: true,
      data: (data || []) as ProviderConfigResponse[]
    };
  } catch (error: any) {
    console.error('Error loading all provider configs:', error);
    return {
      success: false,
      error: error.message || 'Failed to load configs'
    };
  }
}

// =====================================================
// SAVE CONFIGURATION
// =====================================================

/**
 * Save a provider configuration
 */
export async function saveProviderConfig<T = any>(
  params: SaveProviderConfigParams<T>
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const supabase = await createClient();

    const { tenantId, providerKey, enabled, strategy, config, notes } = params;

    const { error } = await supabase
      .from('tenant_payroll_config')
      .update({
        enabled,
        strategy,
        config,
        notes,
        updated_at: new Date().toISOString()
      })
      .eq('tenant_id', tenantId)
      .eq('provider_key', providerKey);

    if (error) throw error;

    // Revalidate settings page
    revalidatePath('/dashboard/settings');

    return { success: true };
  } catch (error: any) {
    console.error('Error saving provider config:', error);
    return {
      success: false,
      error: error.message || 'Failed to save config'
    };
  }
}

/**
 * Toggle a provider enabled/disabled
 */
export async function toggleProviderEnabled(
  tenantId: string,
  providerKey: ProviderKey,
  enabled: boolean
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from('tenant_payroll_config')
      .update({
        enabled,
        updated_at: new Date().toISOString()
      })
      .eq('tenant_id', tenantId)
      .eq('provider_key', providerKey);

    if (error) throw error;

    // Revalidate settings page
    revalidatePath('/dashboard/settings');

    return { success: true };
  } catch (error: any) {
    console.error('Error toggling provider:', error);
    return {
      success: false,
      error: error.message || 'Failed to toggle provider'
    };
  }
}

// =====================================================
// SPECIFIC PROVIDER HELPERS
// =====================================================

/**
 * Load KPI configuration
 */
export async function loadKPIConfig(tenantId: string) {
  return loadProviderConfig<KPIConfig>(tenantId, 'kpi');
}

/**
 * Save KPI configuration
 */
export async function saveKPIConfig(
  tenantId: string,
  enabled: boolean,
  strategy: 'threshold' | 'linear' | 'tier',
  config: KPIConfig
) {
  return saveProviderConfig({
    tenantId,
    providerKey: 'kpi',
    enabled,
    strategy,
    config
  });
}

/**
 * Load Attendance configuration
 */
export async function loadAttendanceConfig(tenantId: string) {
  return loadProviderConfig<AttendanceConfig>(tenantId, 'attendance');
}

/**
 * Save Attendance configuration
 */
export async function saveAttendanceConfig(
  tenantId: string,
  enabled: boolean,
  strategy: 'late_deduction' | 'absent_deduction' | 'combined',
  config: AttendanceConfig
) {
  return saveProviderConfig({
    tenantId,
    providerKey: 'attendance',
    enabled,
    strategy,
    config
  });
}

/**
 * Load Rating configuration
 */
export async function loadRatingConfig(tenantId: string) {
  return loadProviderConfig<RatingConfig>(tenantId, 'rating');
}

/**
 * Save Rating configuration
 */
export async function saveRatingConfig(
  tenantId: string,
  enabled: boolean,
  strategy: 'threshold' | 'linear' | 'tier',
  config: RatingConfig
) {
  return saveProviderConfig({
    tenantId,
    providerKey: 'rating',
    enabled,
    strategy,
    config
  });
}
