'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from '../user-actions';
import { recordAuditLog } from '../audit-actions';
import { encrypt, decrypt } from '@/lib/crypto';
import type { ZaloConfig } from './types';

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
    .single();

  if (error) {
    throw new Error(`[getZaloConfig] tenants Zalo config query failed: ${error.message}`);
  }

  if (!data) {
    throw new Error('[getZaloConfig] Tenant Zalo config not found');
  }

  return {
    zalo_app_id: data.zalo_app_id || '',
    zalo_secret_key: decrypt(data.zalo_secret_key || ''),
    zalo_oa_id: data.zalo_oa_id || '',
    zalo_access_token: decrypt(data.zalo_access_token || ''),
    zalo_refresh_token: decrypt(data.zalo_refresh_token || ''),
    zalo_token_expires_at: data.zalo_token_expires_at || '',
    zalo_template_reminder_id: data.zalo_template_reminder_id || '',
    zalo_template_birthday_id: data.zalo_template_birthday_id || '',
    zalo_auto_scan: data.zalo_auto_scan !== false
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
  
  try {
    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('zalo_app_id, zalo_secret_key, zalo_access_token, zalo_refresh_token, zalo_token_expires_at')
      .eq('id', tenantId)
      .single();

    if (error || !tenant) {
      console.error('Error fetching tenant for Zalo token:', error);
      return null;
    }

    const { zalo_app_id, zalo_secret_key, zalo_access_token, zalo_refresh_token, zalo_token_expires_at } = tenant;

    // Decrypt fields
    const decryptedSecretKey = decrypt(zalo_secret_key || '');
    const decryptedAccessToken = decrypt(zalo_access_token || '');
    const decryptedRefreshToken = decrypt(zalo_refresh_token || '');

    // Check if configuration is missing or using mock values
    if (!zalo_app_id || !decryptedSecretKey || !decryptedAccessToken || !decryptedRefreshToken) {
      return null;
    }
    if (decryptedSecretKey.includes('••') || decryptedAccessToken.includes('••') || decryptedRefreshToken.includes('••') ||
        decryptedSecretKey === '' || decryptedAccessToken === '' || decryptedRefreshToken === '') {
      return null;
    }

    // Check if the current token is still valid (with a 5-minute buffer)
    const now = new Date();
    const bufferTime = new Date(now.getTime() + 5 * 60 * 1000); // 5 mins in the future
    if (zalo_token_expires_at) {
      const expiresAt = new Date(zalo_token_expires_at);
      if (expiresAt > bufferTime) {
        return decryptedAccessToken;
      }
    }

    // Access token has expired or is about to expire, refresh it!
    console.log(`Zalo access token expired for tenant ${tenantId}. Refreshing...`);
    
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
      console.error(`Failed to refresh Zalo token for tenant ${tenantId}. HTTP status: ${response.status}.`);
      return null;
    }

    const result = await response.json();
    if (!result || !result.access_token) {
      console.error(`Invalid response from Zalo OAuth for tenant ${tenantId}. Error code: ${result?.error_code ?? 'unknown'}.`);
      return null;
    }

    const newAccessToken = result.access_token;
    const newRefreshToken = result.refresh_token || decryptedRefreshToken; // Keep old refresh token if not returned
    const expiresIn = parseInt(result.expires_in) || 86400; // default 24h if missing
    const newExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Save the new tokens to the DB
    const { error: saveError } = await supabase
      .from('tenants')
      .update({
        zalo_access_token: encrypt(newAccessToken),
        zalo_refresh_token: encrypt(newRefreshToken),
        zalo_token_expires_at: newExpiresAt
      })
      .eq('id', tenantId);

    if (saveError) {
      console.error(`Error saving refreshed Zalo tokens to DB for tenant ${tenantId}:`, saveError);
    } else {
      console.log(`Successfully refreshed Zalo access token for tenant ${tenantId}. Expires at: ${newExpiresAt}`);
    }

    return newAccessToken;
  } catch (err) {
    console.error(`Exception in getOrRefreshZaloToken for tenant ${tenantId}:`, err);
    return null;
  }
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
