/**
 * Email Service - SendGrid integration
 * 
 * Features:
 * - SendGrid SMTP for production
 * - Console logging for development
 * - Graceful fallback if API key not configured
 */

import sgMail from '@sendgrid/mail';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Initialize SendGrid
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const DEFAULT_FROM_EMAIL = process.env.EMAIL_FROM || 'noreply@bella-erp.com';

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

/**
 * Send email via SendGrid or console log in dev
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  const { to, subject, html, text, from } = options;

  // Development: Log to console
  if (process.env.NODE_ENV === 'development') {
    console.log('\n📧 ===== EMAIL SENT (DEV MODE) =====');
    console.log(`From: ${from || DEFAULT_FROM_EMAIL}`);
    console.log(`To: ${Array.isArray(to) ? to.join(', ') : to}`);
    console.log(`Subject: ${subject}`);
    console.log('\n--- HTML Body ---');
    console.log(html);
    if (text) {
      console.log('\n--- Text Body ---');
      console.log(text);
    }
    console.log('=====================================\n');

    return {
      success: true,
      messageId: `dev-${Date.now()}`,
    };
  }

  // Production: SendGrid
  if (!SENDGRID_API_KEY) {
    console.warn('[sendEmail] SENDGRID_API_KEY not configured. Email not sent.');
    console.log(`Would send to: ${Array.isArray(to) ? to.join(', ') : to}`);
    console.log(`Subject: ${subject}`);
    
    return {
      success: false,
      error: 'SENDGRID_API_KEY not configured',
    };
  }

  try {
    const msg = {
      to: Array.isArray(to) ? to : [to],
      from: from || DEFAULT_FROM_EMAIL,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML tags for text fallback
    };

    const response = await sgMail.send(msg);
    
    console.log(`[sendEmail] Email sent successfully to ${Array.isArray(to) ? to.join(', ') : to}`);
    
    return {
      success: true,
      messageId: response[0]?.headers?.['x-message-id'] || `sg-${Date.now()}`,
    };
  } catch (error) {
    console.error('[sendEmail] SendGrid error:', error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send partner verification email
 */
export async function sendPartnerVerificationEmail(
  email: string,
  applicantName: string,
  verificationToken: string
): Promise<EmailResult> {
  const { generatePartnerVerificationEmail } = await import('./templates/partner-verification');
  
  // Build verification URL
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const verificationUrl = `${baseUrl}/partner/verify?token=${verificationToken}`;

  const emailContent = generatePartnerVerificationEmail({
    applicantName,
    verificationUrl,
    expiresInHours: 24,
  });

  return sendEmail({
    to: email,
    subject: emailContent.subject,
    html: emailContent.html,
    text: emailContent.text,
  });
}

/**
 * Send partner approval email with activation link
 */
export async function sendPartnerApprovalEmail(
  email: string,
  applicantName: string,
  businessName: string,
  activationToken: string,
  tenantSubdomain?: string
): Promise<EmailResult> {
  const { generatePartnerApprovalEmail } = await import('./templates/partner-approval');
  
  // Build activation URL
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const activationUrl = `${baseUrl}/partner/activate?token=${activationToken}`;

  const emailContent = generatePartnerApprovalEmail({
    applicantName,
    businessName,
    activationUrl,
    expiresInHours: 48, // 48 hours for activation
    tenantSubdomain,
  });

  return sendEmail({
    to: email,
    subject: emailContent.subject,
    html: emailContent.html,
    text: emailContent.text,
  });
}

/**
 * Send partner rejection email
 */
export async function sendPartnerRejectionEmail(
  email: string,
  applicantName: string,
  businessName: string,
  rejectionReason: string,
  canReapply: boolean = true
): Promise<EmailResult> {
  const { generatePartnerRejectionEmail } = await import('./templates/partner-rejection');
  
  // Build re-apply URL if allowed
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const reapplyUrl = canReapply ? `${baseUrl}/partner/register` : undefined;

  const emailContent = generatePartnerRejectionEmail({
    applicantName,
    businessName,
    rejectionReason,
    canReapply,
    reapplyUrl,
  });

  return sendEmail({
    to: email,
    subject: emailContent.subject,
    html: emailContent.html,
    text: emailContent.text,
  });
}

/**
 * Send partner request additional info email
 */
export async function sendPartnerRequestInfoEmail(
  email: string,
  applicantName: string,
  businessName: string,
  requestedInfo: string,
  adminName?: string,
  adminEmail?: string
): Promise<EmailResult> {
  const { generatePartnerRequestInfoEmail } = await import('./templates/partner-request-info');
  
  // Optional: Build submission URL for self-service update
  // const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  // const submissionUrl = `${baseUrl}/partner/application-status?id=...`;

  const emailContent = generatePartnerRequestInfoEmail({
    applicantName,
    businessName,
    requestedInfo,
    adminName,
    adminEmail,
    // submissionUrl, // TODO: Implement self-service update portal
  });

  return sendEmail({
    to: email,
    subject: emailContent.subject,
    html: emailContent.html,
    text: emailContent.text,
  });
}
