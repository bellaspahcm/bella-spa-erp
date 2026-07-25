# Marketing Intelligence - Testing Guide

Hướng dẫn test đầy đủ cho Marketing Intelligence Layer (Phase 3).

## 📋 Mục Lục

1. [Chuẩn Bị](#chuẩn-bị)
2. [Test Cron Job](#test-cron-job)
3. [Test Marketing APIs](#test-marketing-apis)
4. [Setup Test Data](#setup-test-data)
5. [Troubleshooting](#troubleshooting)

---

## 🔧 Chuẩn Bị

### Bước 1: Start Development Server

```bash
npm run dev
```

Server sẽ chạy tại: `http://localhost:3000`

### Bước 2: Kiểm Tra Environment Variables

Mở file `.env.local` và verify các biến sau:

```bash
# Cron job authentication
CRON_SECRET=bella_cron_secret_dev_2026_secure_key_12345

# Supabase credentials
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Bước 3: Verify Database

Marketing Intelligence cần các tables sau:
- `tenants` (existing)
- `marketing_campaigns` (new - from migrations)
- `external_ads_data` (new - from migrations)
- `mv_campaign_performance` (new - materialized view)
- `mv_channel_performance` (new - materialized view)

**Check migrations status:**
```bash
supabase db diff
```

---

## 🧪 Test Cron Job

### Option 1: PowerShell Script (Windows - Recommended)

```powershell
# Test local development server
.\scripts\test-marketing-sync.ps1 local

# Test production (requires URL and secret)
.\scripts\test-marketing-sync.ps1 prod
```

### Option 2: Bash Script (Linux/Mac)

```bash
# Make script executable
chmod +x scripts/test-marketing-sync.sh

# Test local
./scripts/test-marketing-sync.sh local

# Test production
./scripts/test-marketing-sync.sh prod
```

### Option 3: Manual cURL Tests

#### Test 1: Health Check
```bash
curl http://localhost:3000/api/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-06-22T..."
}
```

#### Test 2: Cron Job - No Auth (Should Fail)
```bash
curl http://localhost:3000/api/cron/sync-external-ads
```

**Expected Response:** `401 Unauthorized`
```json
{
  "error": "Unauthorized",
  "details": "Missing Authorization header"
}
```

#### Test 3: Cron Job - Invalid Token (Should Fail)
```bash
curl -H "Authorization: Bearer wrong-token" \
  http://localhost:3000/api/cron/sync-external-ads
```

**Expected Response:** `401 Unauthorized`
```json
{
  "error": "Unauthorized",
  "details": "Invalid CRON_SECRET"
}
```

#### Test 4: Cron Job - Valid Token (Should Succeed)
```bash
curl -H "Authorization: Bearer bella_cron_secret_dev_2026_secure_key_12345" \
  http://localhost:3000/api/cron/sync-external-ads
```

**Expected Response:** `200 OK`
```json
{
  "success": true,
  "message": "Sync job completed successfully",
  "data": {
    "startTime": "2026-06-22T10:00:00.000Z",
    "endTime": "2026-06-22T10:00:01.234Z",
    "duration": 1234,
    "summary": {
      "tenantsProcessed": 0,
      "tenantsSucceeded": 0,
      "tenantsFailed": 0,
      "totalRecordsSynced": 0
    },
    "results": [],
    "errors": []
  }
}
```

**Giải thích:** Nếu `tenantsProcessed = 0`, nghĩa là không có tenant nào có ads credentials. Đây là expected behavior ban đầu.

#### Test 5: Manual Trigger (POST)
```bash
curl -X POST \
  -H "Authorization: Bearer bella_cron_secret_dev_2026_secure_key_12345" \
  -H "Content-Type: application/json" \
  -d '{"platforms":["facebook","google"]}' \
  http://localhost:3000/api/cron/sync-external-ads
```

---

## 🔍 Test Marketing APIs

### Test 1: Campaign Analytics

```bash
# Test với dummy campaign ID (sẽ trả về 404)
curl "http://localhost:3000/api/intelligence/marketing/campaign-analytics?campaignId=00000000-0000-0000-0000-000000000001&period=month"
```

**Expected Response:** `404 Not Found`
```json
{
  "error": "Campaign not found",
  "details": "Campaign not found: 00000000-0000-0000-0000-000000000001"
}
```

### Test 2: Channel Performance

```bash
# Test với dummy tenant ID (sẽ trả về empty array)
curl "http://localhost:3000/api/intelligence/marketing/channel-performance?tenantId=00000000-0000-0000-0000-000000000001&period=month"
```

**Expected Response:** `200 OK`
```json
{
  "data": [],
  "metadata": {
    "generatedAt": "2026-06-22T10:00:00.000Z",
    "cacheHit": false,
    "queryTimeMs": 45,
    "dataSourcesUsed": ["mv_channel_performance"]
  }
}
```

### Test 3: ROI Report

```bash
curl "http://localhost:3000/api/intelligence/marketing/roi-report?tenantId=00000000-0000-0000-0000-000000000001&period=month&groupBy=campaign"
```

**Expected Response:** `200 OK`
```json
{
  "data": {
    "groupBy": "campaign",
    "dateRange": {
      "start": "2026-05-22",
      "end": "2026-06-22"
    },
    "items": [],
    "summary": {
      "totalSpend": 0,
      "totalRevenue": 0,
      "totalROI": 0,
      "avgROAS": 0,
      "totalConversions": 0,
      "totalImpressions": 0,
      "totalClicks": 0
    }
  },
  "metadata": {
    "generatedAt": "2026-06-22T10:00:00.000Z",
    "cacheHit": false,
    "queryTimeMs": 32,
    "dataSourcesUsed": ["mv_campaign_performance"]
  }
}
```

### Test 4: Ad Spend Summary

```bash
curl "http://localhost:3000/api/intelligence/marketing/ad-spend-summary?tenantId=00000000-0000-0000-0000-000000000001&period=month"
```

### Test 5: Top Performing Ads

```bash
curl "http://localhost:3000/api/intelligence/marketing/top-performing-ads?tenantId=00000000-0000-0000-0000-000000000001&metric=roi&limit=10"
```

### Test 6: Parameter Validation

#### Invalid UUID format
```bash
curl "http://localhost:3000/api/intelligence/marketing/campaign-analytics?campaignId=invalid-uuid&period=month"
```

**Expected:** `400 Bad Request`
```json
{
  "error": "Invalid campaignId format (must be UUID)"
}
```

#### Invalid period value
```bash
curl "http://localhost:3000/api/intelligence/marketing/channel-performance?tenantId=00000000-0000-0000-0000-000000000001&period=invalid"
```

**Expected:** `400 Bad Request`
```json
{
  "error": "Invalid period. Must be one of: day, week, month, quarter, year"
}
```

#### Invalid platform filter
```bash
curl "http://localhost:3000/api/intelligence/marketing/channel-performance?tenantId=00000000-0000-0000-0000-000000000001&period=month&platforms=invalid,facebook"
```

**Expected:** `400 Bad Request`
```json
{
  "error": "Invalid platform(s): invalid. Must be one of: facebook, google, tiktok, zalo"
}
```

---

## 💾 Setup Test Data

Để test với real data, bạn cần:

1. Create marketing campaigns
2. Add ads credentials to tenant
3. Insert sample external ads data

### Bước 1: Run SQL Script

1. Mở **Supabase SQL Editor**
2. Copy toàn bộ nội dung từ `scripts/setup-marketing-test-data.sql`
3. **Thay thế** các placeholder:
   - `YOUR_TENANT_ID` → ID của tenant bạn muốn test
   - `CAMPAIGN_ID_1` → ID của campaign được tạo ở bước 2

4. Run từng section một (không run toàn bộ file cùng lúc):
   - STEP 1: Add ads credentials to tenant
   - STEP 2: Create test campaigns (note the IDs returned)
   - STEP 3: Insert sample ads data (thay campaign ID)
   - STEP 4: Verify data

### Bước 2: Verify Test Data Created

#### Check tenant has credentials:
```sql
SELECT 
    id,
    name,
    metadata->'ads_credentials' as ads_credentials
FROM tenants
WHERE metadata->'ads_credentials' IS NOT NULL;
```

#### Check campaigns created:
```sql
SELECT id, name, status, budget, external_mappings
FROM marketing_campaigns
WHERE tenant_id = 'YOUR_TENANT_ID'
ORDER BY created_at DESC;
```

#### Check external ads data:
```sql
SELECT 
    platform,
    COUNT(*) as records,
    SUM(spend) as total_spend,
    SUM(revenue) as total_revenue
FROM external_ads_data
WHERE tenant_id = 'YOUR_TENANT_ID'
GROUP BY platform;
```

### Bước 3: Test APIs với Real Data

Sau khi setup test data, chạy lại các API tests:

```bash
# Thay YOUR_TENANT_ID và YOUR_CAMPAIGN_ID bằng IDs thực
TENANT_ID="your-actual-tenant-id"
CAMPAIGN_ID="your-actual-campaign-id"

# Test Campaign Analytics (should return real data now)
curl "http://localhost:3000/api/intelligence/marketing/campaign-analytics?campaignId=$CAMPAIGN_ID&period=month"

# Test Channel Performance
curl "http://localhost:3000/api/intelligence/marketing/channel-performance?tenantId=$TENANT_ID&period=month"

# Test ROI Report
curl "http://localhost:3000/api/intelligence/marketing/roi-report?tenantId=$TENANT_ID&period=month&groupBy=campaign"

# Test Ad Spend Summary
curl "http://localhost:3000/api/intelligence/marketing/ad-spend-summary?tenantId=$TENANT_ID&period=month"

# Test Top Performing Ads
curl "http://localhost:3000/api/intelligence/marketing/top-performing-ads?tenantId=$TENANT_ID&metric=roi&limit=10"
```

---

## 🔍 Troubleshooting

### Issue 1: "CRON_SECRET not configured"

**Problem:** API returns 500 with "CRON_SECRET environment variable is missing"

**Solution:**
1. Check `.env.local` has `CRON_SECRET` defined
2. Restart dev server: `npm run dev`
3. Verify environment variable loaded:
   ```bash
   node -e "console.log(process.env.CRON_SECRET)"
   ```

### Issue 2: "401 Unauthorized" even with correct token

**Problem:** Always getting 401 even when using correct CRON_SECRET

**Possible Causes:**
1. Token has whitespace (copy-paste issue)
2. Bearer prefix missing or incorrect format
3. Environment variable not loaded

**Solution:**
```bash
# Correct format
curl -H "Authorization: Bearer bella_cron_secret_dev_2026_secure_key_12345" \
  http://localhost:3000/api/cron/sync-external-ads

# Wrong formats (will fail):
curl -H "Authorization: bella_cron_secret..." # Missing "Bearer"
curl -H "Authorization: bearer bella_cron_secret..." # Wrong case
curl -H "Authorization:  Bearer bella_cron_secret..." # Extra space
```

### Issue 3: "Failed to fetch tenants"

**Problem:** Cron job returns database error

**Possible Causes:**
1. Supabase connection issue
2. Missing SUPABASE_SERVICE_ROLE_KEY
3. Wrong database credentials

**Solution:**
1. Check `.env.local` for Supabase credentials
2. Test connection:
   ```bash
   curl http://localhost:3000/api/health
   ```
3. Check Supabase dashboard is accessible

### Issue 4: "Campaign not found" for valid campaign

**Problem:** API returns 404 even when campaign exists

**Possible Causes:**
1. Campaign not in `marketing_campaigns` table
2. Wrong tenant_id (cross-tenant access)
3. Migrations not applied

**Solution:**
1. Verify campaign exists:
   ```sql
   SELECT id, name FROM marketing_campaigns 
   WHERE id = 'YOUR_CAMPAIGN_ID';
   ```
2. Check tenant matches:
   ```sql
   SELECT tenant_id FROM marketing_campaigns 
   WHERE id = 'YOUR_CAMPAIGN_ID';
   ```
3. If table doesn't exist, run migrations:
   ```bash
   supabase db push
   ```

### Issue 5: Empty data returned

**Problem:** APIs return empty arrays or null data

**Expected Behavior:**
- This is normal if:
  - No campaigns created yet
  - No external ads data synced yet
  - Tenant has no ads credentials
  
**Solution:**
- Run `scripts/setup-marketing-test-data.sql` to create test data
- Or wait for real data after configuring connectors

### Issue 6: TypeScript errors during build

**Problem:** Build fails with type errors

**Solution:**
```bash
# Clean build
rm -rf .next
npm run build

# If still failing, check for type mismatches
npm run type-check
```

---

## 📊 Expected Test Results Summary

| Test | Expected Result | What it Means |
|------|----------------|---------------|
| Health Check | 200 OK | Server running |
| Cron - No Auth | 401 | Security working |
| Cron - Wrong Token | 401 | Token validation working |
| Cron - Valid Token | 200, tenantsProcessed=0 | No tenants with credentials yet (normal) |
| Campaign Analytics (no data) | 404 | Campaign doesn't exist (normal) |
| Channel Performance (no data) | 200, empty array | No ads data yet (normal) |
| ROI Report (no data) | 200, empty items | No campaigns yet (normal) |
| Invalid UUID | 400 | Validation working |
| Invalid period | 400 | Validation working |
| Invalid platform | 400 | Validation working |

---

## 🎯 Next Steps After Testing

1. **If all tests pass:**
   - ✅ Cron job infrastructure is working
   - ✅ API endpoints are accessible
   - ✅ Validation is working correctly

2. **To get real data:**
   - Run `scripts/setup-marketing-test-data.sql` for test data
   - OR configure real ads credentials and wait for daily sync

3. **For production deployment:**
   - Set production `CRON_SECRET` in Vercel environment variables
   - Configure Vercel Cron (already in `vercel.json`)
   - Add real tenant ads credentials
   - Monitor first sync at 3:00 AM

4. **For monitoring:**
   - Check Vercel Function Logs for cron execution
   - Query `cron_job_logs` table (if created)
   - Set up Slack/email alerts (TODO)

---

## 📝 Test Checklist

Use this checklist to verify all components:

### Cron Job Tests
- [ ] Health check passes (200 OK)
- [ ] No auth rejected (401)
- [ ] Wrong token rejected (401)
- [ ] Valid token accepted (200)
- [ ] POST endpoint works
- [ ] Job completes without errors
- [ ] Logs show correct tenant count

### API Tests
- [ ] Campaign Analytics endpoint accessible
- [ ] Channel Performance endpoint accessible
- [ ] ROI Report endpoint accessible
- [ ] Ad Spend Summary endpoint accessible
- [ ] Top Performing Ads endpoint accessible
- [ ] UUID validation works (400 for invalid)
- [ ] Period validation works (400 for invalid)
- [ ] Platform validation works (400 for invalid)

### Data Tests (After Setup)
- [ ] Tenant has ads credentials
- [ ] Marketing campaigns created
- [ ] External ads data exists
- [ ] APIs return real data (not empty)
- [ ] Campaign Analytics shows metrics
- [ ] ROI Report calculates correctly
- [ ] Top Performing Ads ranks correctly

### Build Tests
- [ ] TypeScript compiles (0 errors)
- [ ] All routes registered
- [ ] No console errors in dev mode

---

**Last Updated:** 2026-06-22  
**Phase:** Marketing Intelligence (Phase 3, Task #9)  
**Status:** ✅ Testing Infrastructure Complete
