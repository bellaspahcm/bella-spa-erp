# 🚀 Continue From Here: Day 11-12 Notification Service

**Current Status:** Provider interface complete, ready for implementation  
**Next Task:** Implement SMS Provider (Twilio)  
**Estimated Time:** 6-8 hours remaining for full notification system

---

## ✅ What's Already Done

1. **Architecture & Types** ✅
   - `src/services/notifications/types.ts` - All TypeScript interfaces
   - `src/services/notifications/providers/provider-interface.ts` - Abstract base class
   - `docs/phases/PHASE_1_WAITLIST_DAY_11_12_NOTIFICATION_IMPLEMENTATION_PLAN.md` - Full plan

2. **Foundation** ✅
   - Provider pattern designed
   - MockNotificationProvider for testing
   - Database schema already has `waitlist_notification_logs` table

---

## 🎯 Next Steps (in order)

### Step 1: Install Dependencies (5 min)
```bash
npm install twilio @sendgrid/mail
```

### Step 2: Setup Environment Variables (5 min)
Create `.env.local` (or add to existing):
```bash
# Twilio SMS
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+84xxxxxxxxx

# SendGrid Email
SENDGRID_API_KEY=SG.your_api_key
SENDGRID_FROM_EMAIL=noreply@bellaspa.vn
SENDGRID_FROM_NAME=Bella Spa

# Config
NOTIFICATION_MAX_RETRIES=3
NOTIFICATION_RETRY_DELAY_MINUTES=5
```

### Step 3: Implement SMS Provider (1 hour)
**File:** `src/services/notifications/providers/sms-provider.ts`

**Key Requirements:**
- Extend `NotificationProvider` abstract class
- Use Twilio REST API
- Format Vietnam phone numbers (+84)
- Handle errors (rate limit, invalid number, etc.)
- Return messageId (Twilio SID)

**Template:**
```typescript
import twilio from 'twilio';
import { NotificationProvider } from './provider-interface';
import type { SendNotificationInput, SendNotificationResult } from '../types';

export class TwilioSMSProvider extends NotificationProvider {
  private client: twilio.Twilio;

  constructor(config: ProviderConfig) {
    super(config, 'twilio-sms');
    
    if (!config.accountSid || !config.authToken) {
      throw new Error('Twilio credentials required');
    }
    
    this.client = twilio(config.accountSid, config.authToken);
  }

  async send(input: SendNotificationInput): Promise<SendNotificationResult> {
    this.validateInput(input);
    
    if (!input.recipient.phone) {
      return {
        success: false,
        error: 'Phone number required for SMS',
        errorCode: 'MISSING_PHONE',
      };
    }

    try {
      // Format phone (+84xxxxxxxxx)
      const phone = this.formatPhone(input.recipient.phone);
      
      // Load template and interpolate
      const message = await this.buildMessage(input);
      
      // Send via Twilio
      const result = await this.client.messages.create({
        body: message,
        from: this.config.fromPhone,
        to: phone,
      });
      
      return {
        success: true,
        messageId: result.sid,
        deliveryStatus: 'queued',
        metadata: { provider: 'twilio', to: phone },
      };
    } catch (error) {
      const { message, code } = this.formatError(error);
      return {
        success: false,
        error: message,
        errorCode: code,
      };
    }
  }

  private formatPhone(phone: string): string {
    // Convert 0901234567 → +84901234567
    // ... implementation
  }

  private async buildMessage(input: SendNotificationInput): Promise<string> {
    // Load template based on input.type
    // Interpolate variables from input.data
    // ... implementation
  }
}
```

### Step 4: Implement Email Provider (1 hour)
**File:** `src/services/notifications/providers/email-provider.ts`

**Similar structure to SMS, but:**
- Use SendGrid API
- HTML + plain text versions
- Subject line
- Unsubscribe link

### Step 5: Create Notification Templates (1 hour)
**File:** `src/services/notifications/notification-templates.ts`

**4 templates needed:**
1. `slot_available` - "Có chỗ trống cho {{serviceName}} vào {{date}} lúc {{time}}"
2. `position_updated` - "Bạn đã lên vị trí #{{position}}"
3. `expiring_soon` - "Lịch hẹn sẽ hết hạn sau 2 giờ"
4. `expired` - "Lịch hẹn đã hết hạn"

**Template engine:**
```typescript
export function interpolateTemplate(
  template: string,
  data: NotificationTemplateData
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return String(data[key] || '');
  });
}
```

### Step 6: Implement Notification Logger (1 hour)
**File:** `src/services/notifications/notification-logger.ts`

**Functions:**
```typescript
export async function logNotificationAttempt(
  entry: NotificationLogEntry
): Promise<string> {
  // Insert into waitlist_notification_logs
  // Return notification_log.id
}

export async function updateNotificationStatus(
  logId: string,
  status: 'sent' | 'delivered' | 'failed',
  metadata?: Record<string, unknown>
): Promise<void> {
  // Update status + timestamps
}

export async function getNotificationLogs(
  entryId: string
): Promise<WaitlistNotificationLog[]> {
  // Fetch by waitlist_entry_id
}
```

### Step 7: Build Notification Service Orchestrator (2 hours)
**File:** `src/services/notifications/notification-service.ts`

**Main function:**
```typescript
export async function sendNotification(input: {
  entryId: string;
  customerId: string;
  tenantId: string;
  type: NotificationType;
  data: NotificationTemplateData;
}): Promise<{ success: boolean; logId?: string; error?: string }> {
  try {
    // 1. Fetch customer details (phone, email, tier)
    // 2. Select channel based on tier
    // 3. Get provider (SMS/Email/Zalo)
    // 4. Send notification
    // 5. Log to database
    // 6. Schedule retry if failed
    // 7. Return result
  } catch (error) {
    // Handle errors
  }
}
```

### Step 8: Update Waitlist Service (1 hour)
**File:** `src/services/waitlist/waitlist-service.ts`

**Functions to modify:**

1. **processSlotAvailable()** - Replace console.log
```typescript
// OLD
console.log('Would notify customer:', entry.id);

// NEW
await sendNotification({
  entryId: entry.id,
  customerId: entry.customer_id,
  tenantId: entry.tenant_id,
  type: 'slot_available',
  data: {
    customerName: entry.customer_name,
    serviceName: entry.package_name,
    date: entry.preferred_date,
    time: slot.start_time,
    matchScore: matchScore,
  },
});
```

2. **expireOldEntries()** - Send expiry notification

3. **addToWaitlist()** (optional) - Confirmation notification

### Step 9: Create Notification Log API (30 min)
**File:** `src/app/api/waitlist/[entryId]/notifications/route.ts`

```typescript
export async function GET(
  request: Request,
  { params }: { params: { entryId: string } }
) {
  const { entryId } = params;
  
  // Fetch notifications from DB
  const notifications = await getNotificationLogs(entryId);
  
  return NextResponse.json({ notifications });
}
```

**Update Detail Page:**
```typescript
// In WaitlistDetailContent.tsx
useEffect(() => {
  const fetchNotifications = async () => {
    const response = await fetch(`/api/waitlist/${entryId}/notifications`);
    const data = await response.json();
    setNotifications(data.notifications);
  };
  
  void fetchNotifications();
}, [entryId]);
```

### Step 10: Setup Cron Jobs (30 min)
**File:** `vercel.json`
```json
{
  "crons": [
    {
      "path": "/api/cron/waitlist-expiry",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/cron/notification-retry",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

**Files to create:**
- `src/app/api/cron/waitlist-expiry/route.ts`
- `src/app/api/cron/notification-retry/route.ts`

---

## 🧪 Testing Checklist

After implementation:
- [ ] Test SMS to real Vietnam phone
- [ ] Test email to real email address
- [ ] Check Twilio dashboard for delivery status
- [ ] Check SendGrid dashboard for open rate
- [ ] Verify notification_logs table populated
- [ ] Test retry logic (temporarily break Twilio credentials)
- [ ] Test detail page notification history display
- [ ] Test cron jobs (trigger manually first)

---

## 📞 Getting API Keys

### Twilio (SMS)
1. Sign up: https://www.twilio.com/try-twilio
2. Get free trial credits ($15)
3. Copy Account SID + Auth Token
4. Get a phone number (Vietnam +84 preferred)

### SendGrid (Email)
1. Sign up: https://signup.sendgrid.com/
2. Free tier: 100 emails/day
3. Create API Key
4. Verify sender email

---

## 🚨 Common Issues

### Twilio
- **Invalid phone format:** Must be E.164 (+84xxxxxxxxx)
- **Rate limit:** Free tier limited to verified numbers
- **Cost:** ~$0.05 per SMS in Vietnam

### SendGrid
- **Spam filter:** Verify sender domain (SPF, DKIM)
- **Rate limit:** 100 emails/day on free tier
- **Unsubscribe:** Must include unsubscribe link

---

## 💡 Quick Wins (Optional)

If time-limited, do this minimal version:
1. ✅ Use MockProvider for all channels (no real sending)
2. ✅ Implement logging to database (audit trail)
3. ✅ Update Detail page to show logs
4. ⏸️ Skip real Twilio/SendGrid integration (add later)

This gives you:
- Full notification flow working
- Audit trail visible in UI
- Can test without API keys
- Easy to swap in real providers later

---

## 📚 Reference Files

**Read these for context:**
- `docs/phases/PHASE_1_WAITLIST_DAY_11_12_NOTIFICATION_IMPLEMENTATION_PLAN.md` - Full plan
- `src/services/notifications/types.ts` - Type definitions
- `src/services/notifications/providers/provider-interface.ts` - Base class
- `src/types/waitlist.ts` - Waitlist types (NotificationType, NotificationChannel)

---

**Estimated Total Time:** 6-8 hours  
**When to Ask for Help:** If stuck >30 minutes on any step  
**Next Review:** After Step 7 (Orchestrator complete)

Good luck! 🚀
