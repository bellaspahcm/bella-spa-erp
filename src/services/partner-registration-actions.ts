/**
 * Partner Registration Actions
 * 
 * Public API for partner registration workflow
 * - Create draft applications
 * - Submit for review
 * - Upload documents
 * - Verify email
 * - Check status
 */

'use server';

import { createClient } from '@/lib/supabase-server';
import type {
  PartnerApplication,
  PartnerApplicationInsert,
  PartnerApplicationUpdate,
  PartnerRegistrationResponse,
  EmailVerificationResponse,
  DocumentUploadResponse,
  PartnerApplicationDocument,
} from '@/types/partner-registration.types';

// ============================================================================
// CREATE DRAFT APPLICATION
// ============================================================================

export async function createDraftApplication(
  data: PartnerApplicationInsert
): Promise<PartnerRegistrationResponse> {
  try {
    const supabase = await createClient();
    
    // Create draft application
    const { data: application, error } = await supabase
      .from('partner_applications')
      .insert({
        full_name: data.full_name,
        email: data.email,
        phone: data.phone,
        applicant_type: data.applicant_type,
        company_name: data.company_name || null,
        tax_code: data.tax_code || null,
        business_license: data.business_license || null,
        address: data.address || null,
        city: data.city || null,
        district: data.district || null,
        ward: data.ward || null,
        status: 'draft',
        registration_type: 'partner',
        documents: '[]',
        metadata: '{}',
      } as any)
      .select()
      .single();
    
    if (error) {
      console.error('[createDraftApplication] Error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
    
    return {
      success: true,
      application: application as any, // Types mismatch: Json vs PartnerApplicationDocument[]
    };
  } catch (error) {
    console.error('[createDraftApplication] Exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// UPDATE DRAFT APPLICATION
// ============================================================================

export async function updateDraftApplication(
  applicationId: string,
  data: PartnerApplicationUpdate
): Promise<PartnerRegistrationResponse> {
  try {
    const supabase = await createClient();
    
    // Update application
    const { data: application, error } = await supabase
      .from('partner_applications')
      .update(data as any)
      .eq('id', applicationId)
      .eq('status', 'draft') // Only allow updating drafts
      .select()
      .single();
    
    if (error) {
      console.error('[updateDraftApplication] Error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
    
    if (!application) {
      return {
        success: false,
        error: 'Application not found or not in draft status',
      };
    }
    
    return {
      success: true,
      application: application as any, // Types mismatch: Json vs PartnerApplicationDocument[]
    };
  } catch (error) {
    console.error('[updateDraftApplication] Exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// SUBMIT APPLICATION FOR REVIEW
// ============================================================================

export async function submitApplication(
  applicationId: string
): Promise<PartnerRegistrationResponse> {
  try {
    const supabase = await createClient();
    
    // Generate email verification token
    const { data: tokenData, error: tokenError } = await supabase.rpc(
      'generate_email_verification_token'
    );
    
    if (tokenError || !tokenData) {
      console.error('[submitApplication] Token generation error:', tokenError);
      return {
        success: false,
        error: 'Failed to generate verification token',
      };
    }
    
    const verificationToken = tokenData as string;
    const tokenExpiresAt = new Date();
    tokenExpiresAt.setHours(tokenExpiresAt.getHours() + 24); // 24 hours expiry
    
    // Update application status
    const { data: application, error } = await supabase
      .from('partner_applications')
      .update({
        status: 'pending_verification',
        submitted_at: new Date().toISOString(),
        email_verification_token: verificationToken,
        email_verification_token_expires_at: tokenExpiresAt.toISOString(),
      } as any)
      .eq('id', applicationId)
      .eq('status', 'draft')
      .select()
      .single();
    
    if (error) {
      console.error('[submitApplication] Error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
    
    if (!application) {
      return {
        success: false,
        error: 'Application not found or not in draft status',
      };
    }
    
    // Send verification email
    try {
      const { sendPartnerVerificationEmail } = await import('@/lib/email/email-service');
      await sendPartnerVerificationEmail(
        application.email,
        application.full_name,
        verificationToken
      );
    } catch (emailError) {
      console.error('[submitApplication] Email error:', emailError);
      // Don't fail the whole submission if email fails
    }
    
    return {
      success: true,
      application: application as any, // Types mismatch: Json vs PartnerApplicationDocument[]
    };
  } catch (error) {
    console.error('[submitApplication] Exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// VERIFY EMAIL
// ============================================================================

export async function verifyEmail(token: string): Promise<EmailVerificationResponse> {
  try {
    const supabase = await createClient();
    
    // Call RPC function to verify email
    const { data, error } = await supabase.rpc('verify_partner_application_email', {
      p_token: token,
    });
    
    if (error) {
      console.error('[verifyEmail] Error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
    
    const result = data as { success: boolean; application_id?: string; status?: string; error?: string };
    
    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Verification failed',
      };
    }
    
    return {
      success: true,
      application_id: result.application_id,
      status: result.status as any,
    };
  } catch (error) {
    console.error('[verifyEmail] Exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// RESEND VERIFICATION EMAIL
// ============================================================================

export async function resendVerificationEmail(
  applicationId: string
): Promise<PartnerRegistrationResponse> {
  try {
    const supabase = await createClient();
    
    // Check if application exists and is in correct status
    const { data: existingApp, error: fetchError } = await supabase
      .from('partner_applications')
      .select('*')
      .eq('id', applicationId)
      .eq('status', 'pending_verification')
      .single();
    
    if (fetchError || !existingApp) {
      return {
        success: false,
        error: 'Application not found or not pending verification',
      };
    }
    
    // Generate new verification token
    const { data: tokenData, error: tokenError } = await supabase.rpc(
      'generate_email_verification_token'
    );
    
    if (tokenError || !tokenData) {
      console.error('[resendVerificationEmail] Token generation error:', tokenError);
      return {
        success: false,
        error: 'Failed to generate verification token',
      };
    }
    
    const verificationToken = tokenData as string;
    const tokenExpiresAt = new Date();
    tokenExpiresAt.setHours(tokenExpiresAt.getHours() + 24);
    
    // Update token
    const { data: application, error } = await supabase
      .from('partner_applications')
      .update({
        email_verification_token: verificationToken,
        email_verification_token_expires_at: tokenExpiresAt.toISOString(),
      } as any)
      .eq('id', applicationId)
      .select()
      .single();
    
    if (error) {
      console.error('[resendVerificationEmail] Error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
    
    // TODO: Send verification email
    // await sendVerificationEmail(existingApp.email, verificationToken);
    
    return {
      success: true,
      application: application as any, // Types mismatch: Json vs PartnerApplicationDocument[]
    };
  } catch (error) {
    console.error('[resendVerificationEmail] Exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// UPLOAD DOCUMENT
// ============================================================================

export async function uploadDocument(
  applicationId: string,
  file: File,
  documentType: string
): Promise<DocumentUploadResponse> {
  try {
    const supabase = await createClient();
    
    // Generate unique file name
    const fileExt = file.name.split('.').pop();
    const fileName = `${applicationId}/${documentType}_${Date.now()}.${fileExt}`;
    
    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('partner-application-documents')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });
    
    if (uploadError) {
      console.error('[uploadDocument] Upload error:', uploadError);
      return {
        success: false,
        error: uploadError.message,
      };
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('partner-application-documents')
      .getPublicUrl(fileName);
    
    const document: PartnerApplicationDocument = {
      type: documentType as any,
      url: urlData.publicUrl,
      uploaded_at: new Date().toISOString(),
      file_name: file.name,
      file_size: file.size,
    };
    
    // Update application documents array
    const { data: existingApp } = await supabase
      .from('partner_applications')
      .select('documents')
      .eq('id', applicationId)
      .single();
    
    if (!existingApp) {
      return {
        success: false,
        error: 'Application not found',
      };
    }
    
    const existingDocs = (existingApp.documents as any[]) || [];
    const updatedDocuments = [...existingDocs, document];
    
    const { error: updateError } = await supabase
      .from('partner_applications')
      .update({ documents: updatedDocuments } as any)
      .eq('id', applicationId);
    
    if (updateError) {
      console.error('[uploadDocument] Update error:', updateError);
      return {
        success: false,
        error: updateError.message,
      };
    }
    
    // Log document upload
    await supabase.from('partner_application_logs').insert({
      application_id: applicationId,
      action: 'document_uploaded',
      action_description: `Document uploaded: ${documentType}`,
      performed_by_role: 'system',
      metadata: { document_type: documentType, file_name: file.name },
    } as any);
    
    return {
      success: true,
      document,
    };
  } catch (error) {
    console.error('[uploadDocument] Exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// GET APPLICATION BY ID
// ============================================================================

export async function getApplicationById(
  applicationId: string
): Promise<PartnerRegistrationResponse> {
  try {
    const supabase = await createClient();
    
    const { data: application, error } = await supabase
      .from('partner_applications')
      .select('*')
      .eq('id', applicationId)
      .single();
    
    if (error) {
      console.error('[getApplicationById] Error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
    
    if (!application) {
      return {
        success: false,
        error: 'Application not found',
      };
    }
    
    return {
      success: true,
      application: application as any, // Types mismatch: Json vs PartnerApplicationDocument[]
    };
  } catch (error) {
    console.error('[getApplicationById] Exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// GET APPLICATION BY EMAIL
// ============================================================================

export async function getApplicationByEmail(
  email: string
): Promise<PartnerRegistrationResponse> {
  try {
    const supabase = await createClient();
    
    const { data: applications, error } = await supabase
      .from('partner_applications')
      .select('*')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (error) {
      console.error('[getApplicationByEmail] Error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
    
    if (!applications || applications.length === 0) {
      return {
        success: false,
        error: 'No application found for this email',
      };
    }
    
    return {
      success: true,
      application: applications[0] as any,
    };
  } catch (error) {
    console.error('[getApplicationByEmail] Exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
