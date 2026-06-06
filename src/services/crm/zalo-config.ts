'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from '../user-actions';
import { recordAuditLog } from '../audit-actions';
import { encrypt, decrypt } from '@/lib/crypto';
import type { ZaloConfig } from './types';
import { pickFirstTenantRow } from './tenant-row';

const EMPTY_ZALO_CONFIG: ZaloConfig = {
  zalo_app_id: '',
  zalo_secret_key: '',
  zalo_oa_id: '',
  zalo_access_token: '',
  zalo_refresh_token: '',
  zalo_token_expires_at: '',
  zalo_template_reminder_id: '',
  zalo_template_birthday_id: '',
  zalo_auto_scan: true,
};

function getErrorMessage(error: unknown, fallback = 'Unknown error') {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === 'string' && message.trim() ? message : fallback;
  }
  return fallback;
}

export async function getZaloConfig(): Promise<ZaloConfig> {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id;
  
  if (!tenantId) {
    throw new Error('Unauthorized: Tenant ID is required');
  }

  const { data, error } = await supabase
    .from('tenants')
    .select('zalo_app_id, zalo_secret_key, zalo_oa_id, zalo_access_token, zalo_refresh_token, zalo_token_expires_at, zalo_template_reminder_id, zalo_template_birthday_id, zalo_auto_scan')
    .eq('id', tenantId)
    .limit(1);

  if (error) {
    throw new Error(`[getZaloConfig] tenants Zalo config query failed: ${error.message}`);
  }

  const tenant = pickFirstTenantRow(data);

  if (!tenant) {
    return { ...EMPTY_ZALO_CONFIG };
  }

  return {
    zalo_app_id: tenant.zalo_app_id || '',
    zalo_secret_key: decrypt(tenant.zalo_secret_key || ''),
    zalo_oa_id: tenant.zalo_oa_id || '',
    zalo_access_token: decrypt(tenant.zalo_access_token || ''),
    zalo_refresh_token: decrypt(tenant.zalo_refresh_token || ''),
    zalo_token_expires_at: tenant.zalo_token_expires_at || '',
    zalo_template_reminder_id: tenant.zalo_template_reminder_id || '',
    zalo_template_birthday_id: tenant.zalo_template_birthday_id || '',
    zalo_auto_scan: tenant.zalo_auto_scan !== false
  };
}

export async function saveZaloConfig(config: Partial<ZaloConfig>) {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id;

  if (!tenantId) {
    throw new Error('Unauthorized: Tenant ID is required');
  }

  try {
    // Encrypt sensitive credential fields before saving to DB
    const encryptedConfig = { ...config };
    if (config.zalo_secret_key) {
      encryptedConfig.zalo_secret_key = encrypt(config.zalo_secret_key);
    }
    if (config.zalo_access_token) {
      encryptedConfig.zalo_access_token = encrypt(config.zalo_access_token);
    }
    if (config.zalo_refresh_token) {
      encryptedConfig.zalo_refresh_token = encrypt(config.zalo_refresh_token);
    }

    const { error } = await supabase
      .from('tenants')
      .update(encryptedConfig)
      .eq('id', tenantId);

    if (error) {
      console.error('Error saving Zalo config:', error);
      return { error: 'Lỗi lưu cấu hình: ' + error.message };
    }

    // Mask sensitive keys in audit log
    const auditConfig = { ...config };
    if (auditConfig.zalo_secret_key) auditConfig.zalo_secret_key = '••••••••';
    if (auditConfig.zalo_access_token) auditConfig.zalo_access_token = '••••••••';
    if (auditConfig.zalo_refresh_token) auditConfig.zalo_refresh_token = '••••••••';

    await recordAuditLog({
      action: 'UPDATE',
      table_name: 'tenants',
      record_id: tenantId,
      new_data: auditConfig
    });

    return { success: true };
  } catch (error: unknown) {
    console.error('Error in saveZaloConfig:', error);
    return { error: error instanceof Error ? error.message : 'Lỗi hệ thống khi lưu cấu hình.' };
  }
}

export async function getOrRefreshZaloToken(tenantId: string): Promise<string | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('tenants')
    .select('zalo_app_id, zalo_secret_key, zalo_access_token, zalo_refresh_token, zalo_token_expires_at')
    .eq('id', tenantId)
    .limit(1);

  if (error) {
    throw new Error(`[getOrRefreshZaloToken] tenants token query failed for tenant ${tenantId}: ${error.message}`);
  }

  const tenant = pickFirstTenantRow(data);

  if (!tenant) {
    throw new Error(`[getOrRefreshZaloToken] tenant token row not found for tenant ${tenantId}`);
  }

  const { zalo_app_id, zalo_secret_key, zalo_access_token, zalo_refresh_token, zalo_token_expires_at } = tenant;

  const decryptedSecretKey = decrypt(zalo_secret_key || '');
  const decryptedAccessToken = decrypt(zalo_access_token || '');
  const decryptedRefreshToken = decrypt(zalo_refresh_token || '');

  if (!zalo_app_id || !decryptedSecretKey || !decryptedAccessToken || !decryptedRefreshToken) {
    return null;
  }
  if (decryptedSecretKey.includes('••') || decryptedAccessToken.includes('••') || decryptedRefreshToken.includes('••') ||
      decryptedSecretKey === '' || decryptedAccessToken === '' || decryptedRefreshToken === '') {
    return null;
  }

  const now = new Date();
  const bufferTime = new Date(now.getTime() + 5 * 60 * 1000);
  if (zalo_token_expires_at) {
    const expiresAt = new Date(zalo_token_expires_at);
    if (expiresAt > bufferTime) {
      return decryptedAccessToken;
    }
  }

  console.log(`Zalo credential expired for tenant ${tenantId}. Refreshing...`);

  let result: { access_token?: string; refresh_token?: string; expires_in?: string | number; error_code?: unknown };
  try {
    const response = await fetch('https://oauth.zaloapp.com/v4/oa/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'secret_key': decryptedSecretKey
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: decryptedRefreshToken,
        app_id: zalo_app_id
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    result = await response.json();
  } catch (error: unknown) {
    throw new Error(`[getOrRefreshZaloToken] Zalo OAuth refresh failed for tenant ${tenantId}: ${getErrorMessage(error)}`);
  }

  if (!result || !result.access_token) {
    throw new Error(`[getOrRefreshZaloToken] Zalo OAuth response missing access_token for tenant ${tenantId}: ${String(result?.error_code ?? 'unknown')}`);
  }

  const newAccessToken = result.access_token;
  const newRefreshToken = result.refresh_token || decryptedRefreshToken;
  const expiresIn = parseInt(String(result.expires_in || '86400'), 10) || 86400;
  const newExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  const { error: saveError } = await supabase
    .from('tenants')
    .update({
      zalo_access_token: encrypt(newAccessToken),
      zalo_refresh_token: encrypt(newRefreshToken),
      zalo_token_expires_at: newExpiresAt
    })
    .eq('id', tenantId);

  if (saveError) {
    throw new Error(`[getOrRefreshZaloToken] failed to save refreshed token for tenant ${tenantId}: ${saveError.message}`);
  }

  console.log(`Successfully refreshed Zalo credential for tenant ${tenantId}. Expires at: ${newExpiresAt}`);
  return newAccessToken;
}

export async function getZaloZnsLogs() {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id;

  if (!tenantId) {
    console.warn('[getZaloZnsLogs] Không tìm thấy tenantId cho người dùng hiện tại');
    return [];
  }

  const { data, error } = await supabase
    .from('Notification')
    .select('*')
    .eq('tenantId', tenantId)
    .in('type', ['zalo_zns', 'zalo_birthday'])
    .order('createdAt', { ascending: false })
    .limit(30);

  if (error) {
    throw new Error(`[getZaloZnsLogs] Notification ZNS logs query failed: ${error.message}`);
  }

  return data || [];
}
