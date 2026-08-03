# SMTP Email Configuration Guide

## Current Status
Email service uses `console.log` wrapper. Emails print to terminal instead of sending.

## To Enable Real Emails

### Option 1: Gmail SMTP (Free, Simple)
```typescript
// File: src/lib/email/email-service.ts

import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER, // your-email@gmail.com
    pass: process.env.SMTP_PASS, // App password (not regular password)
  },
});

export async function sendEmail(to: string, subject: string, html: string) {
  const info = await transporter.sendMail({
    from: `"Bella ERP" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  });
  
  console.log('Email sent:', info.messageId);
  return info;
}
```

**Environment Variables:**
```env
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

**Gmail App Password Setup:**
1. Google Account → Security
2. Enable 2-Factor Authentication
3. App Passwords → Generate
4. Copy 16-character password
5. Add to .env.local

### Option 2: SendGrid (Recommended for Production)
```typescript
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

export async function sendEmail(to: string, subject: string, html: string) {
  const msg = {
    to,
    from: 'noreply@bellaerp.com', // Verified sender
    subject,
    html,
  };
  
  await sgMail.send(msg);
  console.log('Email sent via SendGrid');
}
```

**Setup:**
1. Sign up: https://sendgrid.com
2. Create API key
3. Verify sender email/domain
4. Add to .env.local:
```env
SENDGRID_API_KEY=SG.xxx
```

**Install:**
```bash
npm install @sendgrid/mail
```

### Option 3: AWS SES (Cheapest at Scale)
```typescript
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const ses = new SESClient({ 
  region: 'ap-southeast-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  }
});

export async function sendEmail(to: string, subject: string, html: string) {
  const command = new SendEmailCommand({
    Source: 'noreply@bellaerp.com',
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: subject },
      Body: { Html: { Data: html } },
    },
  });
  
  await ses.send(command);
  console.log('Email sent via SES');
}
```

**Setup:**
1. AWS Console → SES
2. Verify sender email/domain
3. Request production access (if needed)
4. Create IAM user with SES permissions
5. Add credentials to .env.local

**Install:**
```bash
npm install @aws-sdk/client-ses
```

## Testing

### 1. Update Service
Replace `console.log` implementation in `src/lib/email/email-service.ts`

### 2. Test Verification Email
```bash
# Trigger: Register at /partner/register
# Check: Email arrives in inbox
# Verify: Token link works
```

### 3. Test Activation Email
```bash
# Trigger: Admin approve application
# Check: Email arrives in inbox
# Verify: Activation link works
```

## Email Templates

Current templates:
- `src/lib/email/templates/partner-verification.ts` (verification)
- Activation email (inline in provisioning engine)

To customize:
1. Edit HTML/CSS in template files
2. Test with real SMTP
3. Check spam folder if not arriving
4. Verify SPF/DKIM records (for production)

## Monitoring

### Gmail/SendGrid Dashboard
- Delivery rates
- Bounce rates
- Spam complaints

### Application Logs
```sql
-- Check email sends
SELECT 
  action,
  action_description,
  created_at
FROM partner_application_logs
WHERE action IN ('email_sent', 'verification_email_sent', 'activation_email_sent')
ORDER BY created_at DESC;
```

## Production Checklist
- [ ] SMTP credentials in production env
- [ ] Sender email verified
- [ ] SPF/DKIM records configured
- [ ] Rate limits configured (if using Gmail)
- [ ] Bounce handling (optional)
- [ ] Unsubscribe link (for marketing emails)
- [ ] Email templates tested on multiple clients

## Cost Estimates

| Provider | Free Tier | Paid Tier |
|----------|-----------|-----------|
| Gmail | 500/day | N/A (not for production) |
| SendGrid | 100/day | $14.95/mo (50k emails) |
| AWS SES | 3,000/mo (if on EC2) | $0.10/1000 emails |

## Support
- Gmail: community.google.com
- SendGrid: support.sendgrid.com
- AWS SES: aws.amazon.com/support
