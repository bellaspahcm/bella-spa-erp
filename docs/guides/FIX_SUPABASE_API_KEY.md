# Fix Supabase API Key - Step-by-Step Guide

## ⚠️ PROBLEM

Tests failing with error:
```
Invalid API key
Hint: Double check your Supabase `anon` or `service_role` API key
```

---

## 🔑 SOLUTION: REGENERATE SERVICE ROLE KEY

### STEP 1: Open Supabase Dashboard

1. Go to: https://supabase.com/dashboard/project/lvnvkpyxtuilhrabtlwv
2. Login if needed

### STEP 2: Navigate to API Settings

1. Click **"Settings"** (⚙️ icon) in left sidebar
2. Click **"API"**

### STEP 3: Get Service Role Key

1. Scroll down to **"Project API keys"** section
2. Find **"service_role"** key (marked as `secret`)
3. Click **"Reveal"** button
4. Click **"Copy"** button

**⚠️ IMPORTANT**: 
- This is a **SECRET** key (never commit to git)
- Has full database access (bypass RLS)
- Only use in backend/tests

### STEP 4: Update .env.local

1. Open `.env.local` in your editor
2. Find line: `SUPABASE_SERVICE_ROLE_KEY=...`
3. Replace old key with new key
4. Save file

**Example**:
```env
# Before (invalid/expired)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.OLD_KEY_HERE

# After (new key from dashboard)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.NEW_KEY_HERE
```

### STEP 5: Verify Key Works

Run verification script:
```powershell
node scripts/check-booking-engine-test-data.js
```

**Expected output**:
```
✅ Tenants: 1 found
✅ Customers: X found
✅ Packages: X found
✅ Bookings: X found
✅ Users (KTV): X found
✅ Table "waitlist" exists and accessible
✅ Table "pricing_rules" exists and accessible
✅ Table "capacity_snapshots" exists and accessible
✅ Table "booking_events" exists and accessible

✅ ALL PREREQUISITES MET!

You can now run tests:
  npm run test:booking-engine
```

---

## 🐛 TROUBLESHOOTING

### Issue: "Invalid API key" after update
**Solution**: 
- Make sure you copied the **service_role** key, not **anon** key
- No extra spaces or newlines
- Key should start with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.`

### Issue: "No tenants found"
**Solution**: Database is empty, need to seed demo data

### Issue: "No customers found"
**Solution**: 
```sql
-- Create test customer
INSERT INTO customers (tenant_id, phone, name_mother, status)
SELECT id, '+84999999999', 'Test Mother', 'active'
FROM tenants LIMIT 1;
```

### Issue: "No KTV users found"
**Solution**:
```sql
-- Create test KTV user
INSERT INTO users (tenant_id, email, name, role, status)
SELECT id, 'test-ktv@test.com', 'Test KTV', 'ktv', 'active'
FROM tenants LIMIT 1;
```

---

## ✅ AFTER FIX

Once key is valid and test data exists, run tests:

```powershell
npm run test:booking-engine
```

Expected:
```
Test Suites: 2 passed, 2 total
Tests:       46 passed, 46 total
Time:        ~10s
```

---

## 🔒 SECURITY NOTES

- **NEVER** commit `.env.local` to git (already in `.gitignore`)
- **NEVER** share service role key publicly
- **NEVER** use service role key in frontend code
- **ROTATE** keys periodically for security

---

**Need help?** Show me the error message and I'll help debug!
