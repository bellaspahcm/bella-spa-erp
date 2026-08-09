/**
 * Partner Provisioning Engine
 * 
 * Responsibilities:
 * 1. Create tenant
 * 2. Create auth user (via Supabase Auth Admin API)
 * 3. Link user to tenant
 * 4. Assign partner role
 * 5. Generate activation token
 * 6. Send activation email
 * 
 * Called when admin approves partner application
 */

import { createClient } from '@/lib/supabase-server';

export interface ProvisioningResult {
  success: boolean;
  tenant_id?: string;
  user_id?: string;
  activation_token?: string;
  tenant_subdomain?: string;
  error?: string;
  details?: string;
}

export interface PartnerProvisioningInput {
  application_id: string;
  full_name: string;
  email: string;
  phone: string;
  company_name?: string;
  tax_code?: string;
}

/**
 * Provision partner account (tenant + user + roles)
 */
export async function provisionPartnerAccount(
  input: PartnerProvisioningInput
): Promise<ProvisioningResult> {
  try {
    const supabase = createClient();
    
    // Step 1: Check if tenant already exists
    const { data: existingTenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('email', input.email)
      .single();

    if (existingTenant) {
      return {
        success: false,
        error: 'Tenant already exists for this email',
      };
    }

    // Step 2: Create tenant
    const tenantName = input.company_name || input.full_name;
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        name: tenantName,
        email: input.email,
        phone: input.phone,
        tax_code: input.tax_code,
        status: 'active',
        metadata: {
          source: 'partner_registration',
          application_id: input.application_id,
        },
      } as unknown)
      .select()
      .single();

    if (tenantError || !tenant) {
      console.error('[provisionPartnerAccount] Tenant creation failed:', tenantError);
      return {
        success: false,
        error: 'Failed to create tenant',
        details: tenantError?.message,
      };
    }

    // Step 3: Create auth user with temporary password
    const tempPassword = generateTemporaryPassword();
    
    // Note: This requires admin privileges - service_role key
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: input.email,
      password: tempPassword,
      email_confirm: true, // Auto-confirm email (already verified in registration)
      user_metadata: {
        full_name: input.full_name,
        phone: input.phone,
        tenant_id: tenant.id,
        source: 'partner_registration',
      },
    });

    if (authError || !authUser.user) {
      console.error('[provisionPartnerAccount] User creation failed:', authError);
      
      // Rollback: Delete tenant
      await supabase.from('tenants').delete().eq('id', tenant.id);
      
      return {
        success: false,
        error: 'Failed to create user account',
        details: authError?.message,
      };
    }

    // Step 4: Assign partner role
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({
        user_id: authUser.user.id,
        role_name: 'partner',
        tenant_id: tenant.id,
      } as unknown);
    
    if (roleError) {
      console.error('[provisionPartnerAccount] Role assignment failed:', roleError);
      // Continue anyway - role can be assigned later manually
    }

    // Step 5: Generate activation token
    const activationToken = generateActivationToken();
    const tokenExpiresAt = new Date();
    tokenExpiresAt.setHours(tokenExpiresAt.getHours() + 72); // 72 hours to activate

    // Step 6: Update application with provisioning results
    const { error: updateError } = await supabase
      .from('partner_applications')
      .update({
        status: 'provisioned',
        tenant_id: tenant.id,
        identity_id: authUser.user.id,
        activation_token: activationToken,
        activation_token_expires_at: tokenExpiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      } as unknown)
      .eq('id', input.application_id);

    if (updateError) {
      console.error('[provisionPartnerAccount] Application update failed:', updateError);
      // Continue anyway - can be fixed manually
    }

    // Step 7: Log provisioning action
    await supabase
      .from('partner_application_logs')
      .insert({
        application_id: input.application_id,
        action: 'provisioned',
        action_description: `Account provisioned: Tenant ${tenant.id}, User ${authUser.user.id}`,
        performed_by_role: 'system',
        metadata: {
          tenant_id: tenant.id,
          user_id: authUser.user.id,
        },
      } as unknown);

    // Step 8: Send activation email (async, don't block)
    sendActivationEmail(input.email, input.full_name, activationToken).catch((err) => {
      console.error('[provisionPartnerAccount] Activation email failed:', err);
    });

    return {
      success: true,
      tenant_id: tenant.id,
      user_id: authUser.user.id,
      activation_token: activationToken,
    };

  } catch (error) {
    console.error('[provisionPartnerAccount] Exception:', error);
    return {
      success: false,
      error: 'Provisioning failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Generate temporary password (user will change on first login)
 */
function generateTemporaryPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

/**
 * Generate activation token
 */
function generateActivationToken(): string {
  return Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
}

/**
 * Send activation email
 */
async function sendActivationEmail(
  email: string,
  name: string,
  token: string
): Promise<void> {
  const { sendEmail } = await import('@/lib/email/email-service');
  
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const activationUrl = `${baseUrl}/partner/activate?token=${token}`;

  await sendEmail({
    to: email,
    subject: '🎉 Chào mừng bạn đến với Bella ERP - Kích hoạt tài khoản',
    html: `
      <h2>Xin chào ${name}!</h2>
      <p>Hồ sơ đăng ký đối tác của bạn đã được phê duyệt! 🎉</p>
      <p>Tài khoản của bạn đã được tạo. Vui lòng kích hoạt và đặt mật khẩu:</p>
      <p>
        <a href="${activationUrl}" style="display: inline-block; padding: 12px 24px; background: #f43f5e; color: white; text-decoration: none; border-radius: 6px;">
          Kích hoạt tài khoản
        </a>
      </p>
      <p>Link kích hoạt có hiệu lực trong 72 giờ.</p>
      <p>Nếu nút không hoạt động, copy link sau: ${activationUrl}</p>
    `,
    text: `
Xin chào ${name}!

Hồ sơ đăng ký đối tác của bạn đã được phê duyệt!

Tài khoản của bạn đã được tạo. Vui lòng kích hoạt và đặt mật khẩu tại:
${activationUrl}

Link kích hoạt có hiệu lực trong 72 giờ.
    `,
  });
}
