/**
 * Email Service - Simple wrapper for sending emails
 * 
 * Currently supports:
 * - Console logging (development)
 * - TODO: SMTP (Gmail/SendGrid)
 * - TODO: Supabase Edge Functions
 */

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

/**
 * Send email (console log only for now)
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  const { to, subject, html, text, from } = options;

  // Development: Log to console
  if (process.env.NODE_ENV === 'development') {
    console.log('\n📧 ===== EMAIL SENT (DEV MODE) =====');
    console.log(`From: ${from || 'noreply@bella-erp.com'}`);
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

  // Production: TODO - Implement actual email sending
  console.warn('[sendEmail] Email service not configured in production');
  console.log(`Would send email to: ${Array.isArray(to) ? to.join(', ') : to}`);
  console.log(`Subject: ${subject}`);

  return {
    success: true,
    messageId: `mock-${Date.now()}`,
  };
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
