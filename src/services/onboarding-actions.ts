'use server';

import { createClient } from '@/lib/supabase-server';
import { safeRevalidatePath } from '@/lib/revalidate';
import type { Database } from '@/types/database.types';

type AuthUser = { id: string };
type AdminAuthClient = {
  auth: {
    admin: {
      deleteUser: (id: string) => Promise<{ error: { message: string } | null }>;
    };
  };
};
type TenantUpdate = Database['public']['Tables']['tenants']['Update'];

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Lỗi không xác định xảy ra';
}

function formatCleanupNote(label: string, message: string) {
  return message ? `; ${label} failed: ${message}` : '';
}

async function rollbackCreatedAuthUser(
  supabaseAdmin: AdminAuthClient | null,
  authUserId: string,
) {
  if (!supabaseAdmin) {
    return '';
  }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(authUserId);
  return error?.message || '';
}

export interface RegisterTenantInput {
  spaName: string;
  contactPhone: string;
  address: string;
  email: string;
  adminName: string;
  adminEmail: string;
  adminPassword?: string;
  branchType?: 'owned' | 'franchise';
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
    // Create the Auth User. If SUPABASE_SERVICE_ROLE_KEY is available, we use the Admin API
    // with email_confirm: true to completely bypass email sending and avoid "email rate limit exceeded".
    const password = input.adminPassword || 'Password123!';
    let authUser: AuthUser | null = null;
    let supabaseAdminForAuthRollback: AdminAuthClient | null = null;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (serviceRoleKey) {
      console.log('[registerNewTenant] Creating confirmed user via admin client to bypass email rate limits');
      const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
      const supabaseAdmin = createSupabaseClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          }
        }
      );
      supabaseAdminForAuthRollback = supabaseAdmin as AdminAuthClient;

      const { data: adminData, error: adminError } = await supabaseAdmin.auth.admin.createUser({
        email: input.adminEmail,
        password: password,
        email_confirm: true,
        user_metadata: {
          full_name: input.adminName,
        }
      });

      if (adminError) {
        console.error('[registerNewTenant] Admin auth signup failed:', adminError.message);
        return { success: false, error: adminError.message };
      }

      authUser = adminData?.user?.id ? { id: adminData.user.id } : null;
    } else {
      console.log('[registerNewTenant] SUPABASE_SERVICE_ROLE_KEY not found. Attempting custom RPC create_onboarding_user to bypass rate limits');
      const { data: userId, error: rpcErr } = await supabase.rpc('create_onboarding_user', {
        p_email: input.adminEmail,
        p_password: password,
        p_full_name: input.adminName
      });

      if (rpcErr) {
        console.error('[registerNewTenant] Custom RPC signup failed, falling back to standard signUp:', rpcErr.message);
        
        // Final fallback to standard signUp if custom RPC fails
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
          console.error('[registerNewTenant] Standard auth signup failed:', signUpError.message);
          return { success: false, error: signUpError.message };
        }

        authUser = signUpData?.user?.id ? { id: signUpData.user.id } : null;
      } else if (!userId) {
        console.error('[registerNewTenant] Custom RPC returned null user ID');
        return { success: false, error: 'Không thể tạo tài khoản xác thực qua database.' };
      } else {
        console.log('[registerNewTenant] Custom RPC signup succeeded, user ID:', userId);
        authUser = { id: userId as string };
      }
    }

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
      const authRollbackError = await rollbackCreatedAuthUser(supabaseAdminForAuthRollback, authUser.id);
      const rollbackNote = formatCleanupNote('auth cleanup', authRollbackError);
      return { success: false, error: `${rpcError.message}${rollbackNote}` };
    }

    // 3.1. Update franchise agreement details if Nhượng quyền (Franchise) is chosen
    if (input.branchType === 'franchise') {
      const today = new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'
      const franchiseUpdate: TenantUpdate = {
        franchise_agreement_date: today,
        royalty_type: 'percentage'
      };
      const { error: updateError } = await supabase
        .from('tenants')
        .update(franchiseUpdate)
        .eq('id', tenantId as string);

      if (updateError) {
        console.error('[registerNewTenant] Post-onboarding franchise update failed:', updateError.message);
        return { success: false, error: `Lỗi cập nhật cấu hình nhượng quyền: ${updateError.message}` };
      }
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
      return {
        success: false,
        error: `Failed to record onboarding audit log: ${getErrorMessage(auditErr)}`,
        data: {
          tenantId,
          userId: authUser.id,
          email: input.adminEmail
        }
      };
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
    const errorMessage = getErrorMessage(error);
    return { success: false, error: errorMessage };
  }
}
