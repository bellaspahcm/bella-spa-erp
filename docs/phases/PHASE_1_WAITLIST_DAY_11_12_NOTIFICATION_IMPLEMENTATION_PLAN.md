# Phase 1 Waitlist: Day 11-12 Notification Service Implementation Plan

**Date:** 2026-07-12  
**Status:** In Progress  
**Duration:** 2 days

---

## 🎯 Goals

Transform waitlist from queue management to real-time communication:
- Replace `console.log` with real SMS/Email/Zalo delivery
- Log all notifications to `waitlist_notification_logs` table
- Populate notification history in detail page
- Setup automated cron jobs for expiry and retry
- Ensure delivery reliability with retry logic

---

## 📐 Architecture Design

### Provider Pattern (Strategy)
```
NotificationService (orchestrator)
  ├── SMSProvider (interface)
  │   └── TwilioProvider (implementation)
  ├── EmailProvider (interface)
  │   └── SendGridProvider (implementation)
  └── ZaloProvider (interface)
      └── ZaloBusinessProvider (implementation - placeholder)
```

### Channel Priority (by Customer Tier)
- **VIP:** Zalo → SMS → Email
- **Loyal:** SMS → Email → Zalo
- **New:** Email → SMS

### Notification Flow
```
1. Trigger event (slot available, position updated, expiring)
2. NotificationService.send(entry, type)
3. Select channel based on tier + preferences
4. Call provider.send(message, recipient)
5. Log to waitlist_notification_logs
6. Handle delivery status (sent/failed)
7. Schedule retry if failed (max 3 attempts)
```

---

## 📁 File Structure

```
src/services/notifications/
├── notification-service.ts        # Main orchestrator
├── notification-logger.ts         # Database logging
├── notification-templates.ts      # Message templates
├── providers/
│   ├── provider-interface.ts      # Abstract interface
│   ├── sms-provider.ts            # SMS (Twilio)
│   ├── email-provider.ts          # Email (SendGrid)
│   └── zalo-provider.ts           # Zalo (placeholder)
└── types.ts                       # Notification types

src/lib/config/
└── notification-config.ts         # API keys, config

src/app/api/waitlist/[entryId]/notifications/
└── route.ts                       # GET notification logs

.env.local (add these)
├── TWILIO_ACCOUNT_SID
├── TWILIO_AUTH_TOKEN
├── TWILIO_PHONE_NUMBER
├── SENDGRID_API_KEY
├── SENDGRID_FROM_EMAIL
└── ZALO_APP_ID (future)
```

---

## 🔨 Implementation Tasks (8 tasks)

### Task 1: Provider Interface & Types ⏱️ 30min
**File:** `src/services/notifications/types.ts`
**File:** `src/services/notifications/providers/provider-interface.ts`

Define:
- `NotificationProvider` interface (send method)
- `SendNotificationInput` type
- `SendNotificationResult` type (success, messageId, error)
- `ProviderConfig` type

### Task 2: SMS Provider (Twilio) ⏱️ 1 hour
**File:** `src/services/notifications/providers/sms-provider.ts`

Implement:
- Twilio REST API integration
- Phone number formatting (Vietnam +84)
- Error handling (invalid number, rate limit, etc.)
- Delivery status tracking

**Dependencies:**
```bash
npm install twilio
```

### Task 3: Email Provider (SendGrid) ⏱️ 1 hour
**File:** `src/services/notifications/providers/email-provider.ts`

Implement:
- SendGrid API integration
- HTML email templates (responsive)
- Attachment support (future: booking details PDF)
- Unsubscribe link handling

**Dependencies:**
```bash
npm install @sendgrid/mail
```

### Task 4: Zalo Provider (Placeholder) ⏱️ 30min
**File:** `src/services/notifications/providers/zalo-provider.ts`

Implement:
- Mock implementation (returns success)
- TODO comments for Zalo Business API
- Vietnam-specific considerations

**Note:** Zalo Business API requires:
- Business account registration
- App ID from Zalo OA (Official Account)
- Webhook setup for delivery status
- Complex OAuth flow

### Task 5: Notification Templates ⏱️ 1 hour
**File:** `src/services/notifications/notification-templates.ts`

Create templates for:
1. **slot_available**
   - "Có chỗ trống cho [service] vào [date] lúc [time]. Vui lòng xác nhận trong 30 phút."
   - Include: customer name, service, date, time, booking link
   
2. **position_updated**
   - "Bạn đã lên vị trí #[position] trong hàng chờ [service]."
   - Include: new position, estimated wait time
   
3. **expiring_soon**
   - "Lịch hẹn của bạn sẽ hết hạn sau 2 giờ. Vui lòng xác nhận hoặc liên hệ [phone]."
   - Include: entry details, contact info
   
4. **expired**
   - "Lịch hẹn [service] của bạn đã hết hạn. Vui lòng liên hệ để đặt lại."
   - Include: apology, rebooking link

**Template engine:**
- Simple string interpolation ({{variable}})
- HTML version (email)
- Plain text version (SMS)

### Task 6: Notification Logger ⏱️ 1 hour
**File:** `src/services/notifications/notification-logger.ts`

Implement:
- `logNotificationAttempt()` - Insert to `waitlist_notification_logs`
- `updateNotificationStatus()` - Update delivery status
- `getNotificationLogs()` - Fetch by entry_id
- `scheduleRetry()` - Mark for retry (cron picks up)

**Database operations:**
- Insert with all metadata
- Handle retry_count increment
- Track delivery timestamps (sent_at, delivered_at, read_at)
- Error logging (error_message, error_code)

### Task 7: Notification Service (Orchestrator) ⏱️ 2 hours
**File:** `src/services/notifications/notification-service.ts`

Implement:
- `sendNotification()` - Main entry point
  - Select channel by tier
  - Load template
  - Call provider
  - Log result
  - Schedule retry if failed
  
- `retryFailedNotifications()` - Cron job helper
  - Fetch failed notifications (retry_count < max_retries)
  - Re-send
  - Update retry_count

- `selectChannel()` - Channel selection logic
  - Check customer tier
  - Check customer preferences (future)
  - Fallback chain (e.g., SMS → Email if SMS fails)

### Task 8: Update Waitlist Service Functions ⏱️ 2 hours
**Files to modify:**
- `src/services/waitlist/waitlist-service.ts`

**Functions to update:**

1. **processSlotAvailable()**
   ```typescript
   // Replace console.log
   await notificationService.sendNotification({
     entryId: entry.id,
     customerId: entry.customer_id,
     type: 'slot_available',
     data: { service, date, time, matchScore }
   });
   ```

2. **expireOldEntries()**
   ```typescript
   // Send expiry notification before marking expired
   await notificationService.sendNotification({
     entryId: entry.id,
     customerId: entry.customer_id,
     type: 'expired',
     data: { service, reason: 'timeout' }
   });
   ```

3. **addToWaitlist()** (optional)
   ```typescript
   // Confirmation notification
   await notificationService.sendNotification({
     entryId: newEntry.id,
     customerId: newEntry.customer_id,
     type: 'position_updated',
     data: { position, estimatedWait }
   });
   ```

---

## 🔌 API Endpoint: Notification Logs

### Task 9: Create Notification Log API ⏱️ 1 hour
**File:** `src/app/api/waitlist/[entryId]/notifications/route.ts`

**Endpoint:** `GET /api/waitlist/:entryId/notifications`

**Response:**
```json
{
  "notifications": [
    {
      "id": "uuid",
      "type": "slot_available",
      "channel": "sms",
      "status": "sent",
      "sent_at": "2026-07-12T14:30:00Z",
      "delivered_at": "2026-07-12T14:30:05Z",
      "message_content": "Có chỗ trống cho Premium Massage...",
      "error_message": null
    }
  ],
  "total": 1
}
```

**Update Detail Page:**
- Fetch from new endpoint in `WaitlistDetailContent.tsx`
- Populate `WaitlistNotificationHistory` component

---

## 🕐 Cron Jobs Setup

### Task 10: Hourly Expiry Cron ⏱️ 30min
**Trigger:** Every hour (`:00`)
**Action:** Call `/api/waitlist/expire`
**Payload:** `{ tenant_id: 'all' }` (loop all tenants)

**Vercel Cron (vercel.json):**
```json
{
  "crons": [
    {
      "path": "/api/cron/waitlist-expiry",
      "schedule": "0 * * * *"
    }
  ]
}
```

**New file:** `src/app/api/cron/waitlist-expiry/route.ts`
- Fetch all tenants
- Loop and call `expireOldEntries()` for each
- Log results

### Task 11: 5-Minute Retry Cron ⏱️ 30min
**Trigger:** Every 5 minutes
**Action:** Retry failed notifications (retry_count < max_retries)

**Vercel Cron (vercel.json):**
```json
{
  "crons": [
    {
      "path": "/api/cron/notification-retry",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

**New file:** `src/app/api/cron/notification-retry/route.ts`
- Call `notificationService.retryFailedNotifications()`
- Limit: 100 retries per run
- Log results

---

## ⚙️ Configuration

### Environment Variables (.env.local)
```bash
# Twilio SMS
TWILIO_ACCOUNT_SID=ACxxxxx
TWILIO_AUTH_TOKEN=xxxxx
TWILIO_PHONE_NUMBER=+84xxxxxxxxx

# SendGrid Email
SENDGRID_API_KEY=SG.xxxxx
SENDGRID_FROM_EMAIL=noreply@bellaspa.vn
SENDGRID_FROM_NAME=Bella Spa

# Zalo Business (future)
ZALO_APP_ID=xxxxx
ZALO_APP_SECRET=xxxxx
ZALO_OA_ID=xxxxx

# Notification Config
NOTIFICATION_MAX_RETRIES=3
NOTIFICATION_RETRY_DELAY_MINUTES=5
```

### Notification Config File
**File:** `src/lib/config/notification-config.ts`

```typescript
export const NOTIFICATION_CONFIG = {
  providers: {
    sms: process.env.TWILIO_ACCOUNT_SID ? 'twilio' : 'mock',
    email: process.env.SENDGRID_API_KEY ? 'sendgrid' : 'mock',
    zalo: 'mock', // Always mock for now
  },
  channels: {
    vip: ['zalo', 'sms', 'email'],
    loyal: ['sms', 'email', 'zalo'],
    new: ['email', 'sms'],
  },
  retry: {
    maxAttempts: parseInt(process.env.NOTIFICATION_MAX_RETRIES || '3'),
    delayMinutes: parseInt(process.env.NOTIFICATION_RETRY_DELAY_MINUTES || '5'),
  },
};
```

---

## ✅ Testing Checklist

### Unit Tests (Manual for now)
- [ ] SMS provider sends to Twilio API
- [ ] Email provider sends via SendGrid
- [ ] Template engine interpolates variables
- [ ] Channel selection respects tier priority
- [ ] Logger inserts to database correctly
- [ ] Retry logic increments retry_count

### Integration Tests
- [ ] Add to waitlist → Confirmation SMS sent
- [ ] Process slot → Top 3 customers notified
- [ ] Entry expires → Expiry notification sent
- [ ] Failed notification → Logged as failed
- [ ] Retry cron → Re-sends failed notifications
- [ ] Detail page → Shows notification history

### Manual Testing (with real services)
- [ ] Test SMS to real Vietnam phone (+84...)
- [ ] Test email to real email address
- [ ] Verify delivery status in Twilio dashboard
- [ ] Verify email open tracking in SendGrid
- [ ] Check notification_logs table populated

---

## 📊 Success Metrics

**Before (Day 1-10):**
- ❌ Notifications: console.log only
- ❌ Customer awareness: Zero (no real notifications)
- ❌ Notification history: Empty state

**After (Day 11-12):**
- ✅ Notifications: Real SMS + Email delivery
- ✅ Customer awareness: Instant notifications on slot availability
- ✅ Notification history: Full audit trail in detail page
- ✅ Reliability: 3 automatic retries for failed sends
- ✅ Observability: All notifications logged to database

---

## 🚀 Implementation Timeline

**Day 11 (6-8 hours):**
- Morning: Tasks 1-4 (Provider interfaces + implementations)
- Afternoon: Tasks 5-6 (Templates + Logger)

**Day 12 (6-8 hours):**
- Morning: Tasks 7-9 (Orchestrator + Waitlist integration + API endpoint)
- Afternoon: Tasks 10-11 (Cron jobs + Testing)

**Total Estimate:** 12-16 hours of focused work

---

## 🔒 Security Considerations

1. **API Keys:** Never commit to git, use `.env.local`
2. **Rate Limiting:** Respect Twilio/SendGrid limits (avoid spam)
3. **Unsubscribe:** Add unsubscribe link in emails (GDPR compliance)
4. **Phone Validation:** Validate Vietnam phone format before sending
5. **Tenant Isolation:** All notifications filtered by tenant_id
6. **PII Protection:** Mask phone/email in logs (GDPR)

---

## 📝 Documentation to Update

1. **README.md** - Add notification setup instructions
2. **ENV_TEMPLATE.md** - Document new env vars
3. **DEPLOYMENT.md** - Vercel cron setup guide
4. **PHASE_1_WAITLIST_COMPLETION_REPORT.md** - Final completion summary

---

**Last Updated:** 2026-07-12  
**Status:** Ready to implement  
**Next:** Start with Task 1 (Provider interfaces)

