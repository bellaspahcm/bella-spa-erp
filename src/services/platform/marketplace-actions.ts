'use server';

/**
 * Industry Pack Marketplace Governance Actions
 * Phase C.4 – Industry Pack Marketplace
 *
 * Governance: Constitution #1 (Zero Silent DB Failures), #3 (Strict Types),
 *             #8 (Immutable Finalized), Law 11 (Zero `any`)
 *
 * Now fully typed via generated Database schema — rawFrom helper removed.
 */

import { createClient } from '@/lib/supabase-server';
import { Database } from '@/types/database.types';
import { revalidatePath } from 'next/cache';

// ---------------------------------------------------------------------------
// Generated Types from Supabase Schema
// ---------------------------------------------------------------------------

type PlatformIndustryPackRow = Database['public']['Tables']['platform_industry_packs']['Row'];
type PlatformIndustryPackUpdate = Database['public']['Tables']['platform_industry_packs']['Update'];

// ---------------------------------------------------------------------------
// Public Types
// ---------------------------------------------------------------------------

export interface PackInstallationState {
  id: string;
  packCode: string;
  version: string;
  status: string;
  isFrozen: boolean;
  frozenReason: string | null;
  enabledCapabilities: string[];
  countryPacks: string[];
  complianceStandards: string[];
  maturityLevel: number;
}

function mapPackRow(p: PlatformIndustryPackRow): PackInstallationState {
  return {
    id: p.id,
    packCode: p.pack_code,
    version: p.version,
    status: p.status,
    isFrozen: p.is_frozen ?? false,
    frozenReason: p.frozen_reason ?? null,
    enabledCapabilities: p.enabled_capabilities ?? [],
    countryPacks: p.country_packs ?? [],
    complianceStandards: p.compliance_standards ?? [],
    maturityLevel: p.maturity_level ?? 1,
  };
}

// ---------------------------------------------------------------------------
// Server Actions
// ---------------------------------------------------------------------------

export async function getMarketplacePacksAction(): Promise<{
  data: PackInstallationState[];
  error: string | null;
}> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('platform_industry_packs')
    .select('*')
    .order('pack_code', { ascending: true });

  if (error) {
    return { data: [], error: error.message };
  }

  return { data: (data ?? []).map(mapPackRow), error: null };
}

export async function upgradePackVersionAction(
  packId: string,
  targetVersion: string
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient();

  // Validate freeze policy first
  const { data: pack, error: getError } = await supabase
    .from('platform_industry_packs')
    .select('is_frozen, frozen_reason, pack_code')
    .eq('id', packId)
    .single();

  if (getError || !pack) {
    return { success: false, error: 'Phân hệ không tồn tại trên hệ thống.' };
  }

  if (pack.is_frozen) {
    return {
      success: false,
      error: `Không thể nâng cấp: Phân hệ ${pack.pack_code} đã bị Đóng Băng kiến trúc (Frozen). Lý do: ${pack.frozen_reason ?? 'Không có lý do'}`,
    };
  }

  const updatePayload: PlatformIndustryPackUpdate = {
    version: targetVersion,
    updated_at: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from('platform_industry_packs')
    .update(updatePayload)
    .eq('id', packId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  revalidatePath('/dashboard/marketplace');
  return { success: true, error: null };
}

export async function updatePackStatusAction(
  packId: string,
  status: string
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient();

  // Validate freeze policy
  const { data: pack } = await supabase
    .from('platform_industry_packs')
    .select('is_frozen, pack_code')
    .eq('id', packId)
    .single();

  if (pack?.is_frozen && status !== 'active') {
    return {
      success: false,
      error: `Không thể thay đổi trạng thái: Phân hệ ${pack.pack_code} đã bị Đóng Băng kiến trúc (Frozen).`,
    };
  }

  const updatePayload: PlatformIndustryPackUpdate = {
    status,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('platform_industry_packs')
    .update(updatePayload)
    .eq('id', packId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard/marketplace');
  return { success: true, error: null };
}

export async function requestPackReviewAction(
  packId: string
): Promise<{ success: boolean; error: string | null }> {
  return updatePackStatusAction(packId, 'review');
}
