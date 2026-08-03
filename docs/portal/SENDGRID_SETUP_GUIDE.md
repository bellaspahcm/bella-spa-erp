# SendGrid Setup Guide - Bella ERP Partner Portal

## Overview
This guide walks you through setting up SendGrid for production email sending in the Partner Registration system.

**Time Required:** 15-30 minutes  
**Cost:** Free tier (100 emails/day) or paid plans

---

## Prerequisites
- SendGrid account (free or paid)
- Domain ownership (for sender verification)
- Access to DNS settings (for domain authentication)

---

## Step 1: Create SendGrid Account

### Option A: Free Tier (Recommended for Testing)
1. Go to https://signup.sendgrid.com/
2. Sign up with email
3. Verify your email address
4. Complete account setup

**Limits:** 100 emails/day forever (no credit card required)

### Option B: Paid Plan (Production)
1. Same signup process
2. Add payment method
3. Choose plan based on volume:
   - **Essentials:** $19.95/mo (50K emails/mo)
   - **Pro:** $89.95/mo (1.5M emails/mo)

---

## Step 2: Verify Sender Email (Quick Start)

### For Testing (5 minutes)
1. Go to **Settings → Sender Authentication → Single Sender Verification**
2. Click **Create New Sender**
3. Fill in:
   - From Name: `Bella ERP`
   - From Email: `noreply@yourdomain.com` (or your personal email)
   - Reply To: Same as from email
   - Company: `Bella Group`
   - Address: Your company address
4. Click **Create**
5. Check your email and click verification link

✅ **You can now send emails from this verified address**

---

## Step 3: Domain Authentication (Production Required)

### Why Domain Authentication?
- Improves deliverability (avoids spam folder)
- Builds sender reputation
- Required for high-volume sending

### Setup Steps (15-20 minutes)
1. Go to **Settings → Sender Authentication → Authenticate Your Domain**
2. Click **Get Started**
3. Select DNS host (e.g., Cloudflare, GoDaddy, AWS Route53)
4. Enter your domain: `bellagroup.vn`
5. Click **Next**
6. SendGrid will show DNS records to add

### Example DNS Records to Add:
```
Type: CNAME
Name: s1._domainkey.bellagroup.vn
Value: s1.domainkey.u12345678.wl123.sendgrid.net

Type: CNAME
Name: s2._domainkey.bellagroup.vn
Value: s2.domainkey.u12345678.wl123.sendgrid.net

Type: CNAME
Name: em1234.bellagroup.vn
Value: u12345678.wl123.sendgrid.net
```

7. Add these records to your DNS provider
8. Wait 5-10 minutes for DNS propagation
9. Return to SendGrid and click **Verify**

✅ **Domain authenticated! You can now send from any @bellagroup.vn email**

---

## Step 4: Create API Key

1. Go to **Settings → API Keys**
2. Click **Create API Key**
3. Name: `Bella ERP Partner Portal - Production`
4. Permissions: **Restricted Access**
   - ✅ Mail Send → Full Access
   - ❌ All other permissions → No Access
5. Click **Create & View**
6. **COPY THE API KEY** (you won't see it again!)

Example key format:
```
SG.aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890_AbCdEfGhIjKlMnOpQrStUvWxYz
```

---

## Step 5: Configure Environment Variables

### Local Development (.env.local)
```bash
# SendGrid Configuration
SENDGRID_API_KEY=SG.your-actual-api-key-here
EMAIL_FROM=noreply@bellagroup.vn
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Vercel Production
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add:
   ```
   SENDGRID_API_KEY = SG.your-actual-api-key-here
   EMAIL_FROM = noreply@bellagroup.vn
   NEXT_PUBLIC_APP_URL = https://erp.bellagroup.vn
   ```
3. Select environments: Production, Preview, Development
4. Click **Save**
5. Redeploy your app

### Security Notes
- ⚠️ **NEVER commit API keys to Git**
- ⚠️ Keep `.env.local` in `.gitignore`
- ⚠️ Use environment-specific keys (dev vs prod)
- ⚠️ Rotate keys if exposed

---

## Step 6: Test Email Sending

### Test Script
Create `scripts/test-sendgrid.ts`:
```typescript
import { sendPartnerVerificationEmail } from '@/lib/email/email-service';

async function test() {
  const result = await sendPartnerVerificationEmail(
    'your-email@example.com',
    'John Doe',
    'test-token-123'
  );
  
  console.log('Result:', result);
  
  if (result.success) {
    console.log('✅ Email sent successfully!');
    console.log('Message ID:', result.messageId);
  } else {
    console.log('❌ Email failed:', result.error);
  }
}

test();
```

Run:
```bash
npx tsx scripts/test-sendgrid.ts
```

### Expected Output
```
[sendEmail] Email sent successfully to your-email@example.com
Result: { success: true, messageId: 'sg-1234567890' }
✅ Email sent successfully!
Message ID: sg-1234567890
```

### Check Your Inbox
- Email should arrive within 5-30 seconds
- Check spam folder if not in inbox
- Verify links work correctly

---

## Step 7: Monitor Email Activity

### SendGrid Dashboard
1. Go to **Activity Feed**
2. See real-time email events:
   - ✅ Delivered
   - ✉️ Opened (if tracking enabled)
   - 🔗 Clicked (if tracking enabled)
   - 🚫 Bounced
   - 📮 Spam reports

### Email Statistics
1. Go to **Stats → Overview**
2. Track:
   - Delivery rate (target: >95%)
   - Bounce rate (target: <5%)
   - Spam rate (target: <0.1%)

---

## Troubleshooting

### Error: "SENDGRID_API_KEY not configured"
**Solution:** Verify environment variable is set correctly
```bash
# Check in terminal
echo $SENDGRID_API_KEY

# Or in code
console.log('API Key:', process.env.SENDGRID_API_KEY?.substring(0, 10) + '...');
```

### Error: "The from email does not match a verified Sender Identity"
**Solution:** 
1. Verify sender email in SendGrid dashboard
2. Or complete domain authentication
3. Make sure `EMAIL_FROM` matches verified sender

### Error: "Permission denied"
**Solution:** Recreate API key with "Mail Send → Full Access"

### Emails Going to Spam
**Solutions:**
1. Complete domain authentication (Step 3)
2. Warm up your domain (start with low volume, increase gradually)
3. Avoid spam trigger words in subject/body
4. Include unsubscribe link
5. Check SPF/DKIM/DMARC records

### Low Delivery Rate
**Solutions:**
1. Verify email addresses before sending
2. Remove bounced emails from list
3. Monitor spam complaints
4. Use double opt-in (email verification)
5. Maintain good sender reputation

---

## Production Checklist

Before going live, verify:

- [ ] Domain authenticated in SendGrid
- [ ] Sender email verified
- [ ] API key created with correct permissions
- [ ] Environment variables set in Vercel
- [ ] Test email sent successfully
- [ ] Email arrives in inbox (not spam)
- [ ] Verification link works
- [ ] Activation link works
- [ ] Email tracking enabled (optional)
- [ ] Alert webhooks configured (optional)
- [ ] Monitoring dashboard reviewed

---

## Email Templates Reference

### Verification Email
- **Template:** `src/lib/email/templates/partner-verification.ts`
- **Triggered:** After partner registration
- **Purpose:** Confirm email ownership
- **Link:** `/partner/verify?token=...`

### Approval Email (TODO)
- **Template:** `src/lib/email/templates/partner-approval.ts`
- **Triggered:** After admin approval
- **Purpose:** Notify partner + activation link
- **Link:** `/partner/activate?token=...`

### Rejection Email (TODO)
- **Template:** `src/lib/email/templates/partner-rejection.ts`
- **Triggered:** After admin rejection
- **Purpose:** Notify partner + reason

### Request Info Email (TODO)
- **Template:** `src/lib/email/templates/partner-request-info.ts`
- **Triggered:** Admin requests more info
- **Purpose:** Ask for additional documents/clarification

---

## Advanced Features (Optional)

### Email Tracking
- Enable open/click tracking in SendGrid settings
- Track engagement metrics
- A/B test subject lines

### Webhooks
- Receive real-time events (bounces, spam reports)
- Auto-handle bounced emails
- Monitor deliverability issues

### Email Categories
- Tag emails by type (verification, approval, etc.)
- Filter activity feed by category
- Generate category-specific reports

### Unsubscribe Management
- Add unsubscribe link to transactional emails
- Manage unsubscribe list
- Comply with email regulations

---

## Cost Optimization

### Free Tier Tips
- 100 emails/day = ~3,000/month
- Sufficient for pilot phase
- No credit card required

### When to Upgrade
- Expecting >100 partner registrations/day
- Need higher deliverability guarantees
- Want advanced features (webhooks, tracking)

### Monitoring Usage
- Check **Settings → Account Details → Your Usage**
- Set up alerts for quota thresholds
- Plan upgrade before hitting limits

---

## Support Resources

- **SendGrid Docs:** https://docs.sendgrid.com/
- **API Reference:** https://docs.sendgrid.com/api-reference/
- **Support:** https://support.sendgrid.com/
- **Community:** https://community.sendgrid.com/

---

## Security Best Practices

1. **API Key Rotation**
   - Rotate keys every 90 days
   - Revoke old keys immediately after rotation
   - Never reuse keys across environments

2. **Access Control**
   - Use restricted keys (not full access)
   - Create separate keys per application
   - Audit key usage regularly

3. **Monitoring**
   - Enable alert webhooks
   - Monitor bounce/spam rates
   - Set up anomaly detection

4. **Compliance**
   - Follow CAN-SPAM Act (US)
   - Follow GDPR (EU)
   - Include unsubscribe links
   - Honor opt-out requests within 10 days

---

## Next Steps

After SendGrid setup:
1. ✅ Test all email flows (verify, approve, reject, request-info)
2. ✅ Add remaining email templates (approval, rejection)
3. ✅ Configure email tracking (optional)
4. ✅ Set up webhooks for bounces (optional)
5. ✅ Deploy to staging and test end-to-end
6. ✅ Deploy to production

**Estimated Total Time:** 30 minutes for basic setup, 2-4 hours for full production config.
