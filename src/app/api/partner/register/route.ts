import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { checkRateLimit, getClientIp, RATE_LIMITS, resetRateLimit } from '@/lib/security/rate-limiter';
import { withRecaptchaVerification, RECAPTCHA_THRESHOLDS } from '@/lib/security/recaptcha';
import { checkRegistrationForSpam, logActivity } from '@/lib/security/spam-detector';
import crypto from 'crypto';

/**
 * POST /api/partner/register
 * 
 * Public endpoint for partner registration
 * 
 * Security measures:
 * - Rate limiting (3 per hour per IP)
 * - reCAPTCHA v3 (score >= 0.5)
 * - Spam detection (email, phone, content validation)
 * - IP blocking for high-risk requests
 * 
 * Request Body:
 * {
 *   full_name: string;
 *   email: string;
 *   phone: string;
 *   applicant_type: 'individual' | 'company';
 *   company_name?: string;
 *   tax_code?: string;
 *   business_license?: string;
 *   address?: string;
 *   city?: string;
 *   district?: string;
 *   ward?: string;
 *   recaptcha_token: string;
 * }
 * 
 * Response:
 * {
 *   success: true;
 *   application_id: string;
 *   message: string;
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const body = await request.json();
    
    const {
      full_name,
      email,
      phone,
      applicant_type,
      company_name,
      tax_code,
      business_license,
      address,
      city,
      district,
      ward,
      recaptcha_token,
    } = body;
    
    // ========================================================================
    // SECURITY CHECK #1: Rate Limiting
    // ========================================================================
    const rateLimitResult = checkRateLimit(ip, RATE_LIMITS.PARTNER_REGISTRATION);
    
    if (!rateLimitResult.allowed) {
      // Log rate limit exceeded
      logActivity({
        ip,
        email,
        activityType: 'rate_limit_exceeded',
        timestamp: Date.now(),
        metadata: { endpoint: 'partner_registration' },
      });
      
      return NextResponse.json(
        {
          success: false,
          error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.',
          retryAfter: rateLimitResult.retryAfter,
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimitResult.resetAt).toISOString(),
            'Retry-After': rateLimitResult.retryAfter?.toString() || '3600',
          },
        }
      );
    }
    
    // ========================================================================
    // SECURITY CHECK #2: reCAPTCHA Verification
    // ========================================================================
    const recaptchaResult = await withRecaptchaVerification(
      recaptcha_token,
      'partner_registration',
      RECAPTCHA_THRESHOLDS.REGISTRATION
    );
    
    if (!recaptchaResult.valid) {
      // Log reCAPTCHA failure
      logActivity({
        ip,
        email,
        activityType: 'recaptcha_failed',
        timestamp: Date.now(),
        metadata: {
          error: recaptchaResult.error,
          score: recaptchaResult.score,
        },
      });
      
      return NextResponse.json(
        {
          success: false,
          error: 'Xác thực reCAPTCHA thất bại. Vui lòng thử lại.',
        },
        { status: 400 }
      );
    }
    
    // ========================================================================
    // SECURITY CHECK #3: Spam Detection
    // ========================================================================
    const spamCheck = checkRegistrationForSpam({
      ip,
      email,
      phone,
      companyName: company_name,
      notes: business_license,
    });
    
    // Log spam check result
    logActivity({
      ip,
      email,
      activityType: 'spam_check',
      timestamp: Date.now(),
      metadata: {
        score: spamCheck.score,
        risk: spamCheck.risk,
        reasons: spamCheck.reasons,
        recaptcha_score: recaptchaResult.score,
      },
    });
    
    // Block if high spam score
    if (spamCheck.shouldBlock) {
      return NextResponse.json(
        {
          success: false,
          error: 'Yêu cầu bị từ chối do vi phạm chính sách. Vui lòng liên hệ support.',
        },
        { status: 403 }
      );
    }
    
    // ========================================================================
    // VALIDATION: Required Fields
    // ========================================================================
    if (!full_name || !email || !phone || !applicant_type) {
      return NextResponse.json(
        {
          success: false,
          error: 'Thiếu thông tin bắt buộc',
        },
        { status: 400 }
      );
    }
    
    if (applicant_type === 'company' && !company_name) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tên công ty là bắt buộc đối với doanh nghiệp',
        },
        { status: 400 }
      );
    }
    
    // ========================================================================
    // DATABASE: Create Application
    // ========================================================================
    const supabase = createClient();
    
    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('base64url');
    const tokenExpiresAt = new Date();
    tokenExpiresAt.setHours(tokenExpiresAt.getHours() + 24); // 24 hours
    
    // Check for duplicate email
    const { data: existingApp } = await supabase
      .from('partner_applications')
      .select('id, email, status')
      .eq('email', email)
      .is('deleted_at', null)
      .single();
    
    if (existingApp) {
      // If existing application is draft or pending, allow re-registration
      if (['draft', 'pending_review', 'need_more_info'].includes(existingApp.status)) {
        // Update existing application
        const { data: updated, error: updateError } = await supabase
          .from('partner_applications')
          .update({
            full_name,
            phone,
            applicant_type,
            company_name,
            tax_code,
            business_license,
            address,
            city,
            district,
            ward,
            verification_token: verificationToken,
            verification_token_expires_at: tokenExpiresAt.toISOString(),
            updated_at: new Date().toISOString(),
            metadata: {
              spam_check: spamCheck,
              recaptcha_score: recaptchaResult.score,
              ip_address: ip,
            },
          })
          .eq('id', existingApp.id)
          .select()
          .single();
        
        if (updateError) {
          console.error('[register] Update error:', updateError);
          return NextResponse.json(
            { success: false, error: 'Lỗi cập nhật đơn đăng ký' },
            { status: 500 }
          );
        }
        
        // Send verification email
        try {
          const { sendPartnerVerificationEmail } = await import('@/lib/email/email-service');
          await sendPartnerVerificationEmail(email, full_name, verificationToken);
        } catch (emailError) {
          console.error('[register] Email error:', emailError);
          // Don't fail registration if email fails
        }
        
        // Reset rate limit on successful registration
        resetRateLimit(ip, 'register');
        
        // Log successful registration
        logActivity({
          ip,
          email,
          activityType: 'registration',
          timestamp: Date.now(),
          metadata: { application_id: updated.id, updated: true },
        });
        
        return NextResponse.json({
          success: true,
          application_id: updated.id,
          message: 'Đơn đăng ký đã được cập nhật. Vui lòng kiểm tra email để xác thực.',
        });
      }
      
      // If already approved/provisioned/activated
      return NextResponse.json(
        {
          success: false,
          error: 'Email này đã được đăng ký. Vui lòng liên hệ support nếu cần hỗ trợ.',
        },
        { status: 409 }
      );
    }
    
    // Create new application
    const { data: application, error: insertError } = await supabase
      .from('partner_applications')
      .insert({
        full_name,
        email,
        phone,
        applicant_type,
        company_name,
        tax_code,
        business_license,
        address,
        city,
        district,
        ward,
        status: 'pending_verification',
        registration_type: 'partner',
        verification_token: verificationToken,
        verification_token_expires_at: tokenExpiresAt.toISOString(),
        documents: '[]',
        metadata: {
          spam_check: spamCheck,
          recaptcha_score: recaptchaResult.score,
          ip_address: ip,
          flagged_for_review: spamCheck.shouldReview,
        },
      })
      .select()
      .single();
    
    if (insertError) {
      console.error('[register] Insert error:', insertError);
      return NextResponse.json(
        { success: false, error: 'Lỗi tạo đơn đăng ký' },
        { status: 500 }
      );
    }
    
    // Send verification email
    try {
      const { sendPartnerVerificationEmail } = await import('@/lib/email/email-service');
      await sendPartnerVerificationEmail(email, full_name, verificationToken);
    } catch (emailError) {
      console.error('[register] Email error:', emailError);
      // Don't fail registration if email fails
    }
    
    // Reset rate limit on successful registration
    resetRateLimit(ip, 'register');
    
    // Log successful registration
    logActivity({
      ip,
      email,
      activityType: 'registration',
      timestamp: Date.now(),
      metadata: { application_id: application.id },
    });
    
    return NextResponse.json({
      success: true,
      application_id: application.id,
      message: 'Đăng ký thành công! Vui lòng kiểm tra email để xác thực.',
    });
    
  } catch (error) {
    console.error('[register] Exception:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Lỗi hệ thống. Vui lòng thử lại sau.',
      },
      { status: 500 }
    );
  }
}
