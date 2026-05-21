'use server';

import { createClient } from '@/lib/supabase-server';
import { safeRevalidatePath } from '@/lib/revalidate';

export interface RegisterTenantInput {
  spaName: string;
  contactPhone: string;
  address: string;
  email: string;
  adminName: string;
  adminEmail: string;
  adminPassword?: string;
}

/**
 * Registers a new tenant and configures their initial environment.
 * Leverages the database SECURITY DEFINER function onboard_tenant.
 */
export async function registerNewTenant(input: RegisterTenantInput) {
  const supabase = await createClient();

  try {
    // 1. Validate parameters
    if (!input.spaName || !input.adminName || !input.adminEmail) {
      return { success: false, error: 'Vui lòng điền đầy đủ các thông tin bắt buộc.' };
    }

    // 2. Auth SignUp
    // Create the Auth User. Note that in local development/production, 
    // the password will be stored in auth.users securely.
    const password = input.adminPassword || 'Password123!';
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: input.adminEmail,
      password: password,
      options: {
        data: {
          full_name: input.adminName,
        }
      }
    });

    if (signUpError) {
      console.error('[registerNewTenant] Auth signup failed:', signUpError.message);
      return { success: false, error: signUpError.message };
    }

    const authUser = signUpData?.user;
    if (!authUser) {
      return { success: false, error: 'Không thể tạo tài khoản xác thực. Vui lòng thử lại.' };
    }

    // 3. Call DB Onboarding Function
    type OnboardTenantRpc = (
      fn: 'onboard_tenant',
      args: {
        p_spa_name: string;
        p_contact_phone: string;
        p_address: string;
        p_email: string;
        p_admin_id: string;
        p_admin_email: string;
        p_admin_name: string;
      }
    ) => Promise<{ data: string | null; error: { message: string } | null }>;

    const { data: tenantId, error: rpcError } = await (supabase.rpc as unknown as OnboardTenantRpc)('onboard_tenant', {
      p_spa_name: input.spaName,
      p_contact_phone: input.contactPhone || '',
      p_address: input.address || '',
      p_email: input.email || '',
      p_admin_id: authUser.id,
      p_admin_email: input.adminEmail,
      p_admin_name: input.adminName
    });
 
    if (rpcError) {
      console.error('[registerNewTenant] Database onboarding RPC failed:', rpcError.message);
      
      // Attempt clean up of auth user since DB creation failed
      try {
        // Can only delete if admin client is used, but returning clear error is helpful
        console.warn('[registerNewTenant] DB creation failed. Auth user created: ', authUser.id);
      } catch (e) {
        console.error('Failed to clean up auth user:', e);
      }
 
      return { success: false, error: rpcError.message };
    }
 
    // 4. Record Audit Log for Onboarding
    try {
      const { recordAuditLog } = await import('./audit-actions');
      await recordAuditLog({
        action: 'INSERT',
        table_name: 'tenants',
        record_id: tenantId as string,
        new_data: { 
          id: tenantId,
          name: input.spaName,
          contact_phone: input.contactPhone,
          address: input.address,
          email: input.email
        }
      });
    } catch (auditErr) {
      console.warn('Failed to record onboarding audit log:', auditErr);
    }

    // 5. Clear caches
    await safeRevalidatePath('/dashboard');
    
    return { 
      success: true, 
      data: { 
        tenantId, 
        userId: authUser.id,
        email: input.adminEmail
      } 
    };

  } catch (error: unknown) {
    console.error('[registerNewTenant] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Lỗi không xác định xảy ra';
    return { success: false, error: errorMessage };
  }
}
