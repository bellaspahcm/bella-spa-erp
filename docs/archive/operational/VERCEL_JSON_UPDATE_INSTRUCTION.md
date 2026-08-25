# Vercel.json Update Instruction

## ⚠️ MANUAL UPDATE REQUIRED

Cần update file `vercel.json` để giảm accounting worker cron frequency từ **2 giờ** xuống **15 phút**.

### Current Configuration (vercel.json)

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    {
      "path": "/api/cron/accounting-worker",
      "schedule": "0 2 * * *"   // ❌ Chạy mỗi 2 giờ (2 AM daily)
    },
    {
      "path": "/api/cron/zalo-reminders",
      "schedule": "0 3 * * *"
    },
    {
      "path": "/api/cron/ai-autopilot",
      "schedule": "0 22 * * *"
    }
  ]
}
```

### New Configuration (REQUIRED)

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    {
      "path": "/api/cron/accounting-worker",
      "schedule": "*/15 * * * *"   // ✅ Chạy mỗi 15 phút
    },
    {
      "path": "/api/cron/zalo-reminders",
      "schedule": "0 3 * * *"
    },
    {
      "path": "/api/cron/ai-autopilot",
      "schedule": "0 22 * * *"
    }
  ]
}
```

## Steps to Update

1. **Open `vercel.json`**
2. **Change line 5** from:
   ```json
   "schedule": "0 2 * * *"
   ```
   to:
   ```json
   "schedule": "*/15 * * * *"
   ```
3. **Save file**
4. **Commit and push:**
   ```bash
   git add vercel.json
   git commit -m "chore: reduce accounting worker cron to 15 minutes"
   git push
   ```

## Why This Change?

**Before:**
- Worker chạy 1 lần/ngày lúc 2 AM
- Accounting entries chờ tới 24 giờ mới được process
- Users thấy số liệu báo cáo không real-time

**After:**
- Worker chạy mỗi 15 phút
- Accounting entries được process trong vòng 15 phút
- Users có thể dùng button "Cập nhật số liệu kế toán" để process ngay lập tức
- Balance sheet & trial balance cập nhật gần real-time

## Cron Schedule Explained

| Expression | Meaning |
|------------|---------|
| `0 2 * * *` | At 2:00 AM every day |
| `*/15 * * * *` | Every 15 minutes |
| `*/5 * * * *` | Every 5 minutes (too frequent) |
| `*/30 * * * *` | Every 30 minutes (good balance) |

## Cost Impact (Vercel Pro Plan)

**Current:**
- 1 execution/day = 30 executions/month
- ~0.1 GB-hours/month

**After (15 min):**
- 96 executions/day = 2,880 executions/month
- ~2.9 GB-hours/month

**Verdict:** Insignificant cost increase (~$0.12/month). Benefits far outweigh cost.

## Alternative: 30 Minutes (If Concerned About Cost)

If you want to balance between real-time and cost:

```json
"schedule": "*/30 * * * *"   // Every 30 minutes (48 executions/day)
```

This is still 48x more frequent than current setup!

## Testing After Deployment

1. Wait for next cron execution (max 15 minutes)
2. Check Vercel Dashboard → Deployments → Functions → Cron Logs
3. Verify accounting-worker is executing every 15 minutes
4. Check `pending_accounting_entries` table - should have 0 pending entries

## Related Files Created

- ✅ `src/app/api/admin/accounting/process-outbox/route.ts` - Manual process API
- ✅ `src/hooks/useAccountingOutbox.ts` - React hook for button
- ✅ `src/components/accounting/ProcessOutboxButton.tsx` - UI button component
- ✅ `src/app/dashboard/accounting/reports/page.tsx` - Added button to reports page

---

**Status:** ⚠️ Pending manual update  
**Priority:** High (affects user experience)  
**Estimated Time:** 2 minutes
