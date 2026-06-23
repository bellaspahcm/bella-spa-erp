# Sentry Integration Guide — Error Monitoring for Mobile App
**Date:** 2026-06-22  
**Priority:** 🟡 **HIGH** (parallel with Week 4, but needed before production)  
**Purpose:** Track production errors and performance issues in real-time

---

## 🎯 WHY SENTRY?

### Current Problem
```
Production Error → Không ai biết
```

**Without monitoring:**
- Users experience errors, but team doesn't know
- Can't track error frequency or patterns
- Can't prioritize fixes based on impact
- Can't debug issues without user reports

**With Sentry:**
- Instant notification when errors occur
- See stack traces and context
- Track error trends over time
- Prioritize based on affected users

**User quote:**
> "Tôi xem Sentry là ưu tiên cao hơn nhiều người nghĩ."

---

## 📋 INTEGRATION OVERVIEW

**Total time:** ~3-4 hours

### Phase 1: Setup Sentry Account (30 min)
1. Create Sentry account
2. Create mobile project
3. Get DSN (Data Source Name)

### Phase 2: Install SDK (30 min)
1. Install @sentry/react-native package
2. Configure in app/_layout.tsx
3. Add environment variables

### Phase 3: Error Tracking (1-2 hours)
1. Add error logging to all hooks
2. Add custom context (user, tenant)
3. Add breadcrumbs for debugging

### Phase 4: Error Boundary (30 min)
1. Wrap app with ErrorBoundary
2. Create fallback UI
3. Test crash recovery

### Phase 5: Testing (1 hour)
1. Trigger test errors
2. Verify in Sentry dashboard
3. Test performance tracking
4. Verify filtering works

---

## 🚀 PHASE 1: SETUP SENTRY ACCOUNT

### Step 1.1: Create Sentry Account

1. **Go to:** https://sentry.io/signup/

2. **Sign up with:**
   - Work email (recommended)
   - Or GitHub/Google account

3. **Choose plan:**
   - Developer (Free): 5K errors/month
   - Team ($26/month): 50K errors/month
   - **Recommended:** Start with Developer plan

---

### Step 1.2: Create Mobile Project

1. **After signup, click "Create Project"**

2. **Select Platform:** React Native

3. **Project Details:**
   - **Project Name:** `bella-mobile`
   - **Team:** Your team name
   - **Alert Frequency:** Default (Immediate for Critical)

4. **Click "Create Project"**

---

### Step 1.3: Get DSN

**After project creation, you'll see:**

```
Sentry DSN:
https://[KEY]@[ORG].ingest.sentry.io/[PROJECT-ID]
```

**Save this DSN** - you'll need it for configuration.

**Example:**
```
https://abc123def456@o123456.ingest.sentry.io/7890123
```

---

### Step 1.4: Configure Project Settings

**In Sentry Dashboard → Settings → Projects → bella-mobile:**

1. **Client Keys (DSN):**
   - Copy Production DSN
   - (Optional) Create separate Staging DSN

2. **Issue Grouping:**
   - Enable "Stack Trace Rules"
   - This groups similar errors together

3. **Data Scrubbing:**
   - Enable "Scrub sensitive data"
   - Add patterns to scrub: passwords, tokens, phone numbers

4. **Alerts:**
   - Set up: "Alert when new issue first seen"
   - Set up: "Alert when issue frequency spike"
   - Add your email/Telegram/Slack

---

## 💻 PHASE 2: INSTALL SDK

### Step 2.1: Install Package

```bash
cd "d:\Antigravity\Projects\BELLA SPA ERP"

# Install Sentry SDK for React Native
npm install --save @sentry/react-native --workspace=apps/mobile

# Run setup wizard (optional but recommended)
cd apps/mobile
npx @sentry/wizard@latest -i reactNative
```

**Wizard will:**
- Configure metro.config.js
- Add necessary plugins
- Update app.json

**If wizard fails, continue with manual steps below.**

---

### Step 2.2: Add Environment Variables

**Create/Update `.env` files:**

```env
# apps/mobile/.env.development
EXPO_PUBLIC_SENTRY_DSN=https://[KEY]@[ORG].ingest.sentry.io/[PROJECT-ID]
EXPO_PUBLIC_SENTRY_ENV=development
EXPO_PUBLIC_SENTRY_ENABLED=false  # Disable in dev to avoid noise

# apps/mobile/.env.staging
EXPO_PUBLIC_SENTRY_DSN=https://[KEY]@[ORG].ingest.sentry.io/[PROJECT-ID]
EXPO_PUBLIC_SENTRY_ENV=staging
EXPO_PUBLIC_SENTRY_ENABLED=true

# apps/mobile/.env.production
EXPO_PUBLIC_SENTRY_DSN=https://[KEY]@[ORG].ingest.sentry.io/[PROJECT-ID]
EXPO_PUBLIC_SENTRY_ENV=production
EXPO_PUBLIC_SENTRY_ENABLED=true
```

**Add to `.gitignore`:**
```
apps/mobile/.env.production
apps/mobile/.env.staging
```

**Never commit production DSN to git!**

---

### Step 2.3: Initialize Sentry

**Update `apps/mobile/app/_layout.tsx`:**

```typescript
import * as Sentry from '@sentry/react-native';
import { useEffect } from 'react';

// Initialize Sentry BEFORE app loads
if (process.env.EXPO_PUBLIC_SENTRY_ENABLED === 'true') {
  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    
    // Environment
    environment: process.env.EXPO_PUBLIC_SENTRY_ENV || 'development',
    
    // Enable tracing (performance monitoring)
    tracesSampleRate: 0.2, // 20% of transactions
    
    // Enable auto session tracking
    enableAutoSessionTracking: true,
    sessionTrackingIntervalMillis: 30000, // 30 seconds
    
    // Integrations
    integrations: [
      new Sentry.ReactNativeTracing({
        routingInstrumentation: new Sentry.ReactNavigationInstrumentation(),
      }),
    ],
    
    // Filter events before sending
    beforeSend(event, hint) {
      // Don't send events from development
      if (process.env.EXPO_PUBLIC_SENTRY_ENV === 'development') {
        return null;
      }
      
      // Filter out known non-critical errors
      const error = hint.originalException;
      if (error && typeof error === 'object' && 'message' in error) {
        const message = String(error.message);
        
        // Ignore network timeouts (user's internet issue)
        if (message.includes('timeout') || message.includes('Network request failed')) {
          return null;
        }
        
        // Ignore "cancelled" operations
        if (message.includes('cancelled') || message.includes('AbortError')) {
          return null;
        }
      }
      
      return event;
    },
    
    // Add custom tags
    initialScope: {
      tags: {
        'app.name': 'bella-mobile',
        'app.platform': 'expo',
      },
    },
  });
}

export default function RootLayout() {
  useEffect(() => {
    // Set user context when authenticated
    // (Will be added in Phase 3)
  }, []);
  
  return (
    <Sentry.TouchEventBoundary>
      {/* Existing app content */}
    </Sentry.TouchEventBoundary>
  );
}
```

---

### Step 2.4: Verify Installation

**Add test button to verify Sentry works:**

```typescript
// Temporary test component
import { Button } from 'react-native';
import * as Sentry from '@sentry/react-native';

function TestSentry() {
  return (
    <Button
      title="Test Sentry"
      onPress={() => {
        Sentry.captureException(new Error('Test error from mobile app'));
        Sentry.captureMessage('Test message from mobile app', 'info');
      }}
    />
  );
}
```

**Test:**
1. Add `<TestSentry />` to your app
2. Press button
3. Check Sentry dashboard for event

**If event appears:** ✅ Sentry is working!  
**If no event:** Check DSN and environment variables

---

## 🔍 PHASE 3: ERROR TRACKING

### Step 3.1: Add to All Hooks

**Pattern for error tracking in hooks:**

```typescript
// apps/mobile/src/hooks/useDashboardStats.ts
import * as Sentry from '@sentry/react-native';

export function useDashboardStats(params: {
  tenantId: string | null;
  userId: string;
  role: string;
}) {
  const [kpi, setKpi] = useState<KpiConfig>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenantId) {
      setIsLoading(false);
      setError(null);
      setKpi(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    // ✅ Start Sentry transaction for performance monitoring
    const transaction = Sentry.startTransaction({
      name: 'loadDashboardStats',
      op: 'function.react.hook',
    });

    try {
      const data = await fetchDashboardStats({ tenantId, userId, role });

      if (isTechnicianRole(role)) {
        setKpi({ type: 'technician', data: data as TechnicianKpiData });
      } else {
        setKpi({ type: 'admin', data: data as AdminKpiData });
      }
      setError(null);
      
      transaction.setStatus('ok');
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Không thể tải thống kê';
      
      // ✅ Log error to Sentry with context
      Sentry.captureException(err, {
        level: 'error',
        tags: {
          hook: 'useDashboardStats',
          role: role,
        },
        contexts: {
          fetch: {
            service: 'fetchDashboardStats',
            tenantId: tenantId,
            userId: userId,
            role: role,
          },
        },
      });
      
      setError(errorMessage);
      setKpi(null);
      transaction.setStatus('unknown_error');
    } finally {
      setIsLoading(false);
      transaction.finish();
    }
  }, [tenantId, userId, role]);

  useEffect(() => {
    void load();
  }, [load]);

  return { kpi, isLoading, error, retry: load };
}
```

---

**Apply same pattern to:**

1. **`useTodaySessions.ts`:**
   ```typescript
   Sentry.captureException(err, {
     tags: { hook: 'useTodaySessions' },
     contexts: {
       fetch: {
         service: 'fetchTodaySessions',
         tenantId,
         userId,
         role,
       },
     },
   });
   ```

2. **`AuthContext.tsx` (login errors):**
   ```typescript
   Sentry.captureException(err, {
     tags: { context: 'auth', action: 'login' },
     contexts: {
       auth: {
         phone: phoneNumber,
         step: 'otp_verification',
       },
     },
   });
   ```

3. **`TenantContext.tsx` (tenant loading errors):**
   ```typescript
   Sentry.captureException(err, {
     tags: { context: 'tenant', action: 'load' },
     contexts: {
       tenant: {
         userId: user.id,
       },
     },
   });
   ```

---

### Step 3.2: Add User Context

**Set user context when authenticated:**

```typescript
// apps/mobile/app/_layout.tsx or AuthContext.tsx
import * as Sentry from '@sentry/react-native';

// After successful login
Sentry.setUser({
  id: user.id,
  email: user.email || undefined,
  username: user.full_name || undefined,
  phone: user.phone,
  role: user.role,
});

// Set tenant context
Sentry.setContext('tenant', {
  id: tenant.id,
  name: tenant.name,
  module: tenant.module_key,
});

// On logout
Sentry.setUser(null);
Sentry.setContext('tenant', null);
```

**This helps identify:**
- Which users are affected
- Which tenants have issues
- Role-specific problems

---

### Step 3.3: Add Breadcrumbs

**Add breadcrumbs for better debugging:**

```typescript
// When user performs action
Sentry.addBreadcrumb({
  category: 'user.action',
  message: 'User pulled to refresh dashboard',
  level: 'info',
});

// When navigation occurs
Sentry.addBreadcrumb({
  category: 'navigation',
  message: 'Navigated to dashboard',
  level: 'info',
  data: {
    from: 'login',
    to: 'dashboard',
  },
});

// When data loads
Sentry.addBreadcrumb({
  category: 'data',
  message: 'Dashboard data loaded successfully',
  level: 'info',
  data: {
    sessionsCount: sessions.length,
    kpiType: kpi?.type,
  },
});
```

**Breadcrumbs show sequence of events leading to error.**

---

## 🛡️ PHASE 4: ERROR BOUNDARY

### Step 4.1: Create Error Boundary

**Wrap entire app with Sentry ErrorBoundary:**

```typescript
// apps/mobile/app/_layout.tsx
import * as Sentry from '@sentry/react-native';
import { View, Text, Button, StyleSheet } from 'react-native';

function FallbackComponent({ error, resetError }: {
  error: Error;
  resetError: () => void;
}) {
  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>⚠️</Text>
      </View>
      
      <Text style={styles.title}>Đã xảy ra lỗi</Text>
      
      <Text style={styles.message}>
        Ứng dụng gặp sự cố không mong muốn.{'\n'}
        Lỗi đã được ghi nhận và sẽ được khắc phục sớm.
      </Text>
      
      <Button
        title="Thử lại"
        onPress={resetError}
        color="#E91E63"
      />
      
      {__DEV__ && (
        <Text style={styles.devError}>
          Dev Error: {error.message}
        </Text>
      )}
    </View>
  );
}

export default function RootLayout() {
  return (
    <Sentry.ErrorBoundary
      fallback={FallbackComponent}
      showDialog={false} // Don't show Sentry's default dialog
    >
      <Sentry.TouchEventBoundary>
        {/* Your app content */}
        <AuthProvider>
          <TenantProvider>
            <Stack>
              {/* Routes */}
            </Stack>
          </TenantProvider>
        </AuthProvider>
      </Sentry.TouchEventBoundary>
    </Sentry.ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#F9FAFB',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  icon: {
    fontSize: 40,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  devError: {
    marginTop: 16,
    fontSize: 12,
    color: '#EF4444',
    fontFamily: 'monospace',
  },
});
```

---

### Step 4.2: Test Error Boundary

**Create test crash:**

```typescript
// Temporary test button
function TestCrash() {
  return (
    <Button
      title="Test Crash"
      onPress={() => {
        throw new Error('Test crash for ErrorBoundary');
      }}
    />
  );
}
```

**Expected behavior:**
1. Press button → App crashes
2. ErrorBoundary catches crash
3. Shows fallback UI
4. Error logged to Sentry
5. Press "Thử lại" → App recovers

---

## 🧪 PHASE 5: TESTING

### Step 5.1: Test Error Capture

**Test scenarios:**

1. **Network error:**
   - Turn off network
   - Pull to refresh
   - Check Sentry: Should see error

2. **RPC error:**
   - Temporarily break RPC
   - Load dashboard
   - Check Sentry: Should see error with context

3. **Crash:**
   - Trigger test crash
   - Check Sentry: Should see crash + breadcrumbs

---

### Step 5.2: Verify Dashboard

**In Sentry Dashboard → Issues:**

**Check each error shows:**
- ✅ Error message
- ✅ Stack trace
- ✅ User context (id, role, phone)
- ✅ Tenant context (id, name)
- ✅ Breadcrumbs (actions before error)
- ✅ Device info (OS, model)
- ✅ App version

---

### Step 5.3: Test Alerts

**Trigger multiple errors:**
1. Cause same error 5 times quickly
2. Verify alert email received
3. Check alert shows frequency spike

**Configure alert channels:**
- Email: ✅ Should work by default
- Slack: Add webhook in Settings → Integrations
- Telegram: Use Sentry Telegram integration

---

## ✅ COMPLETION CHECKLIST

### Setup Phase
- [ ] Sentry account created
- [ ] Mobile project created in Sentry
- [ ] DSN obtained
- [ ] Environment variables added
- [ ] SDK installed and configured

### Integration Phase
- [ ] Sentry initialized in app/_layout.tsx
- [ ] Error tracking added to useDashboardStats
- [ ] Error tracking added to useTodaySessions
- [ ] Error tracking added to AuthContext
- [ ] Error tracking added to TenantContext
- [ ] User context set on login
- [ ] User context cleared on logout
- [ ] Breadcrumbs added for key actions

### Error Boundary Phase
- [ ] ErrorBoundary wraps app
- [ ] Fallback UI created
- [ ] Reset functionality works
- [ ] Crash recovery tested

### Testing Phase
- [ ] Test error logged successfully
- [ ] Error appears in Sentry dashboard
- [ ] Stack trace is readable
- [ ] User context is present
- [ ] Breadcrumbs show up
- [ ] Alerts working

### Production Readiness
- [ ] Development events filtered out
- [ ] Sensitive data scrubbed
- [ ] Alert channels configured
- [ ] Team members invited to Sentry
- [ ] Documentation updated

---

## 📊 SUCCESS METRICS

**Sentry is working when:**

### Visibility
- All production errors appear in dashboard within 1 minute
- Stack traces are complete and readable
- User context helps identify affected users
- Breadcrumbs help reproduce issues

### Actionability
- Can identify most critical errors (by frequency/users affected)
- Can prioritize fixes based on data
- Can track error trends over time
- Can verify fixes reduced error rate

### Team Process
- Team receives alerts for critical errors
- Errors are triaged within 24 hours
- Critical errors fixed within 48 hours
- Error rate trends downward

---

## 🚨 IMPORTANT NOTES

### Data Privacy

**DO scrub:**
- Phone numbers (in error messages)
- Email addresses
- OTP codes
- Auth tokens
- User passwords

**Sentry auto-scrubs these patterns**, but double-check your errors.

---

### Performance Impact

**Sentry is lightweight:**
- <100KB added to bundle size
- <50ms overhead per error
- Minimal battery impact

**To minimize impact:**
- Sample rate: 20% for performance monitoring
- Filter non-critical errors (timeouts, cancelled)
- Don't log in development

---

### Cost Management

**Free tier limits:**
- 5,000 errors/month
- 10,000 performance transactions/month

**If exceeding:**
- Increase sample rate filter (more aggressive filtering)
- Upgrade to Team plan ($26/month for 50K)
- Group similar errors to reduce count

---

## 📚 REFERENCES

**Official Docs:**
- Sentry React Native: https://docs.sentry.io/platforms/react-native/
- Expo Integration: https://docs.expo.dev/guides/using-sentry/

**Internal Docs:**
- `WEEK_3_POST_REVIEW_ACTION_PLAN.md` - Why Sentry is needed
- `AGENTS.md` Section 11 - Error handling best practices

---

**Document Owner:** Mobile Development Team  
**Version:** 1.0  
**Last Updated:** 2026-06-22  
**Status:** Ready for implementation  
**Estimated Time:** 3-4 hours total
