'use server';

/**
 * Industry Pack Marketplace Governance Actions
 * Phase C.4 – Industry Pack Marketplace
 *
 * Governance: Constitution #1 (Zero Silent DB Failures), #3 (Strict Types), #8 (Immutable Finalized)
 */

import { createClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { INDUSTRY_PACK_REGISTRY, type IndustryPackManifest } from '@/platform/industry-registry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface PackInstallationState {
  id: string;
  packCode: string;
  version: string;
  status: 'draft' | 'review' | 'active' | 'deprecated' | 'sunset';
  isFrozen: boolean;
  frozenReason: string | null;
  enabledCapabilities: string[];
  countryPacks: string[];
  complianceStandards: string[];
  maturityLevel: number;
}

// ---------------------------------------------------------------------------
// Actions
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

  const packs = (data ?? []).map((p) => ({
    id: p.id,
    packCode: p.pack_code,
    version: p.version,
    status: p.status as PackInstallationState['status'],
    isFrozen: p.is_frozen ?? false,
    frozenReason: p.frozen_reason ?? null,
    enabledCapabilities: p.enabled_capabilities ?? [],
    countryPacks: p.country_packs ?? [],
    complianceStandards: p.compliance_standards ?? [],
    maturityLevel: p.maturity_level ?? 1,
  }));

  return { data: packs, error: null };
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

  // Update pack version
  const { error: updateError } = await supabase
    .from('platform_industry_packs')
    .update({
      version: targetVersion,
      updated_at: new Date().toISOString(),
    })
    .eq('id', packId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  revalidatePath('/dashboard/marketplace');
  return { success: true, error: null };
}

export async function updatePackStatusAction(
  packId: string,
  status: PackInstallationState['status']
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient();

  // Validate freeze policy
  const { data: pack } = await supabase
    .from('platform_industry_packs')
    .select('is_frozen, frozen_reason, pack_code')
    .eq('id', packId)
    .single();

  if (pack?.is_frozen && status !== 'active') {
    return {
      success: false,
      error: `Không thể thay đổi trạng thái: Phân hệ ${pack.pack_code} đã bị Đóng Băng kiến trúc (Frozen).`,
    };
  }

  const { error } = await supabase
    .from('platform_industry_packs')
    .update({ status, updated_at: new Date().toISOString() })
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
