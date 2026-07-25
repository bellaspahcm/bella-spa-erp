# Marketing Intelligence - Quick Start Guide

Hướng dẫn nhanh để test Marketing Intelligence trong 5 phút.

## ⚡ Quick Test (5 phút)

### 1. Start Server
```bash
npm run dev
```

### 2. Run Test Script
```powershell
# Windows
.\scripts\test-marketing-sync.ps1 local
```

**Kết quả mong đợi:**
- ✅ Test 1-3: Pass (health check + auth validation)
- ✅ Test 4: Pass với `tenantsProcessed: 0` (bình thường - chưa có data)
- ✅ Test 5-6: Pass (APIs trả về empty data)

### 3. Done!
Nếu tất cả tests pass → Hệ thống hoạt động đúng ✅

---

## 📚 Để Test Với Real Data

### Step 1: Create Test Data (5 phút)

1. Mở **Supabase SQL Editor**
2. Copy file: `scripts/setup-marketing-test-data.sql`
3. Thay `YOUR_TENANT_ID` bằng tenant ID thực (xem trong Supabase)
4. Run từng section (STEP 1 → STEP 4)

### Step 2: Test APIs Lại

Sau khi tạo data, test lại:

```powershell
.\scripts\test-marketing-sync.ps1 local
```

**Kết quả mong đợi:**
- ✅ Test 4: `tenantsProcessed: 1` (có 1 tenant với credentials)
- ✅ Test 5-6: Trả về real data (campaigns, metrics)

---

## 🔧 Test Individual APIs

### Thay các giá trị:
```bash
TENANT_ID="your-tenant-id-here"
CAMPAIGN_ID="your-campaign-id-here"
```

### Test Campaign Analytics:
```bash
curl "http://localhost:3000/api/intelligence/marketing/campaign-analytics?campaignId=$CAMPAIGN_ID&period=month"
```

### Test Channel Performance:
```bash
curl "http://localhost:3000/api/intelligence/marketing/channel-performance?tenantId=$TENANT_ID&period=month"
```

### Test ROI Report:
```bash
curl "http://localhost:3000/api/intelligence/marketing/roi-report?tenantId=$TENANT_ID&period=month&groupBy=campaign"
```

### Test Top Performing Ads:
```bash
curl "http://localhost:3000/api/intelligence/marketing/top-performing-ads?tenantId=$TENANT_ID&metric=roi&limit=10"
```

---

## 📖 Chi Tiết Hơn?

Xem full guide: [`docs/MARKETING_INTELLIGENCE_TESTING_GUIDE.md`](./MARKETING_INTELLIGENCE_TESTING_GUIDE.md)

Bao gồm:
- 11 test scenarios
- 6 troubleshooting guides
- Test checklist (20+ items)
- SQL setup guide
- Production deployment guide

---

## 🐛 Troubleshooting

### Issue: "CRON_SECRET not configured"
**Fix:** Restart dev server: `npm run dev`

### Issue: "401 Unauthorized"
**Check:** Token trong script đúng với `.env.local`

### Issue: APIs trả về empty data
**Normal:** Chưa có test data. Run `setup-marketing-test-data.sql`

### Issue: "Campaign not found"
**Check:** Campaign ID có tồn tại trong database không?
```sql
SELECT id, name FROM marketing_campaigns LIMIT 5;
```

---

**Last Updated:** 2026-06-22  
**Status:** ✅ Ready to Test
