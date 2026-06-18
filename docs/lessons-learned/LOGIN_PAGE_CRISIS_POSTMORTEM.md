# Login Page Crisis - Postmortem & Lessons Learned

**Incident Date**: 2026-06-18  
**Duration**: ~3 hours  
**Severity**: 🔴 **CRITICAL** - Complete loss of login functionality  
**Impact**: All users unable to access the system from mobile devices

---

## 📋 Timeline of Events

### Initial Report
- **Issue**: iPhone users (iOS 18.7) cannot access login page
- **Symptom**: Sentry error `auto.browser.global_handlers.onerror` on `/login`
- **User Impact**: Complete inability to log in from iPhone Safari

### Fix Attempt #1 - Error Handling (Commit a93a667c)
**Action**: Added error boundaries and initialization checks
- Added `initError` state
- Try-catch wrapper for Supabase initialization
- User-friendly error UI

**Result**: ❌ Failed - Still cannot access login page

### Fix Attempt #2 - Remove Framer Motion (Commit 62e9e9b2)
**Action**: Complete rewrite without framer-motion
- Removed all animations library
- Replaced with inline styles
- Lazy loading for Supabase client
- Vanilla JavaScript only

**Result**: ❌ Failed - Page stuck at infinite loading

### Fix Attempt #3 - ROOT CAUSE FIX (Commit b45e62dd)
**Action**: Fixed TenantContextProvider infinite loop
- Created `TenantContextWrapper` to bypass provider on auth pages
- Added PUBLIC_ROUTES list
- Emergency static login fallback

**Result**: ✅ **SUCCESS** - Login page now works

### Enhancement - Add MFA Support (Current)
**Action**: Re-implement 2FA with vanilla JavaScript
- Two-stage flow: credentials → MFA
- No external animation libraries
- Full iOS Safari compatibility

---

## 🔴 Critical Errors Encountered

### Error #1: Missing Environment Variables
**File**: `src/lib/supabase-public-env.ts`

**Problem**:
```typescript
export function requireSupabasePublicEnv(): { url: string; publicKey: string } {
  const url = getSupabasePublicUrl();
  const publicKey = getSupabasePublicKey();

  if (!url || !publicKey) {
    throw new Error('Missing Supabase credentials'); // ❌ Throws on client
  }

  return { url, publicKey };
}
```

**Why It Failed**:
- Function throws immediately if env vars missing
- On mobile Safari, this caused unhandled exception
- No graceful fallback

**Fix Applied**:
- Added error handling in login page
- Display user-friendly error message
- Provide reload button

**Prevention**:
```typescript
// ✅ Better approach - don't throw in initialization
export function getSupabaseEnv(): { url: string; publicKey: string } | null {
  const url = getSupabasePublicUrl();
  const publicKey = getSupabasePublicKey();
  
  if (!url || !publicKey) {
    console.error('[Supabase] Missing environment variables');
    return null;
  }
  
  return { url, publicKey };
}

// Usage with null check
const env = getSupabaseEnv();
if (!env) {
  // Handle gracefully
  return <ErrorUI />;
}
```

---

### Error #2: Framer Motion iOS Safari Incompatibility
**File**: `src/app/(auth)/login/page.backup.tsx`

**Problem**:
```typescript
import { motion } from 'framer-motion';

<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.6 }}
>
  {children}
</motion.div>
```

**Why It Failed**:
- Framer Motion uses complex animation APIs
- WKWebView on iOS has restrictions on these APIs
- Bundle size is large (~200KB)
- Can cause crashes on slow connections

**Fix Applied**:
- Removed framer-motion entirely
- Used inline styles with vanilla CSS
- Simple transitions via CSS properties

**Prevention**:
```typescript
// ❌ AVOID: External animation libraries for critical pages
import { motion } from 'framer-motion';

// ✅ USE: Vanilla CSS or inline styles
<div style={{
  opacity: isVisible ? 1 : 0,
  transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
  transition: 'all 0.3s ease-out',
}}>
  {children}
</div>

// ✅ OR: CSS animations
<style jsx>{`
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  .animate-in {
    animation: fadeIn 0.6s ease-out;
  }
`}</style>
```

**Rule**:
> 🚫 **NEVER use framer-motion or heavy animation libraries on:**
> - Login/Auth pages
> - Critical user flows
> - Mobile-first pages
> - Pages that must work on all devices

---

### Error #3: TenantContextProvider Infinite Loop ⭐ ROOT CAUSE
**File**: `src/app/layout.tsx`

**Problem**:
```typescript
// ❌ WRONG: Wraps ALL pages including /login
export default async function RootLayout({ children }) {
  return (
    <html>
      <body>
        <TenantContextProvider>  {/* ← This is the problem! */}
          {children}
        </TenantContextProvider>
      </body>
    </html>
  );
}
```

**File**: `src/core/providers/TenantContextProvider.tsx`

```typescript
useEffect(() => {
  async function loadTenantContext() {
    const response = await fetch('/api/tenant/context');
    
    if (response.status === 401) {
      // ❌ Redirects to /login
      window.location.href = '/login';
      return;
    }
    
    // ...
  }
  loadTenantContext();
}, []);
```

**The Infinite Loop**:
```
1. User visits /login (not authenticated)
2. TenantContextProvider mounts
3. Fetches /api/tenant/context
4. API returns 401 (user not logged in)
5. Provider redirects to /login
6. Back to step 2 → INFINITE LOOP
```

**Why Loading Spinner Appeared**:
```typescript
// TenantContextProvider shows loading while fetching
if (loading) {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin ..."></div>
      <p>Đang tải cấu hình chi nhánh...</p>  {/* ← This is what users saw */}
    </div>
  );
}
```

**Fix Applied**:
```typescript
// ✅ CORRECT: Conditional wrapper
export default async function RootLayout({ children }) {
  return (
    <html>
      <body>
        <TenantContextWrapper>  {/* ← Smart wrapper */}
          {children}
        </TenantContextWrapper>
      </body>
    </html>
  );
}
```

**File**: `src/components/providers/TenantContextWrapper.tsx`

```typescript
'use client';

const PUBLIC_ROUTES = [
  '/login',
  '/signup',
  '/forgot-password',
  '/',
  '/book',
];

export default function TenantContextWrapper({ children }) {
  const pathname = usePathname();
  
  const isPublicRoute = PUBLIC_ROUTES.some(route => 
    pathname === route || pathname?.startsWith(route + '/')
  );

  // ✅ Public routes: render directly (no tenant context)
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // ✅ Protected routes: wrap with provider
  return (
    <TenantContextProvider>
      {children}
    </TenantContextProvider>
  );
}
```

**Prevention Rules**:
> ⚠️ **NEVER wrap auth/public pages with providers that:**
> - Require authentication
> - Fetch user data
> - Redirect based on auth state
> - Can create redirect loops

> ✅ **ALWAYS use conditional wrappers for:**
> - Context providers requiring auth
> - Data fetchers depending on login state
> - Protected page logic

**Checklist Before Adding Provider to Root Layout**:
- [ ] Does this provider need authentication?
- [ ] Does it fetch data that requires login?
- [ ] Can it redirect users?
- [ ] Is there a public page that should bypass it?

If ANY answer is "Yes" → Use conditional wrapper, not direct wrap!

---

## 🛡️ Prevention Strategies

### Strategy #1: Environment Variable Validation

**Create**: `scripts/check-required-env.mjs`

```javascript
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing: ${envVar}`);
    process.exit(1);
  }
}

console.log('✅ All required environment variables are set');
```

**Usage**:
```json
{
  "scripts": {
    "build": "npm run env:check && next build",
    "env:check": "node scripts/check-required-env.mjs"
  }
}
```

**Benefit**: Catches missing env vars BEFORE deployment

---

### Strategy #2: Critical Page Testing Checklist

Before deploying changes to auth pages:

**Desktop Browsers**:
- [ ] Chrome (Windows/Mac)
- [ ] Firefox (Windows/Mac)
- [ ] Safari (Mac)
- [ ] Edge (Windows)

**Mobile Browsers** (CRITICAL):
- [ ] iPhone Safari (latest iOS)
- [ ] iPhone Safari (iOS -1 version)
- [ ] iPad Safari
- [ ] Android Chrome
- [ ] Android Firefox

**Test Scenarios**:
- [ ] Page loads without errors
- [ ] Form fields are interactive
- [ ] Login with valid credentials works
- [ ] Login with invalid credentials shows error
- [ ] Offline behavior is graceful
- [ ] Slow connection doesn't timeout

---

### Strategy #3: Provider Architecture Pattern

**Bad Pattern** ❌:
```typescript
// app/layout.tsx
<AuthProvider>
  <TenantProvider>
    <ThemeProvider>
      {children}  {/* ALL pages wrapped */}
    </ThemeProvider>
  </TenantProvider>
</AuthProvider>
```

**Good Pattern** ✅:
```typescript
// app/layout.tsx
<ThemeProvider>  {/* OK - no auth required */}
  <ConditionalAuthWrapper>  {/* Smart wrapper */}
    {children}
  </ConditionalAuthWrapper>
</ThemeProvider>

// components/providers/ConditionalAuthWrapper.tsx
export default function ConditionalAuthWrapper({ children }) {
  const pathname = usePathname();
  
  if (isPublicRoute(pathname)) {
    return <>{children}</>;
  }
  
  return (
    <AuthProvider>
      <TenantProvider>
        {children}
      </TenantProvider>
    </AuthProvider>
  );
}
```

**Rule**:
> Providers should be applied at the **minimum necessary scope**, not globally

---

### Strategy #4: Emergency Fallback Pages

Always have a zero-dependency fallback:

**Created**: `/login-static` page
- Pure HTML form
- No JavaScript required
- POST to traditional API endpoint
- Works on ALL browsers

**When to Use**:
- Main login page has critical bug
- JavaScript fails to load
- User has JS disabled
- Emergency access needed

**Benefit**: Business continuity even during critical failures

---

### Strategy #5: Lazy Loading for Non-Critical Dependencies

**Bad** ❌:
```typescript
import { getSupabase } from '@/lib/supabase-client';
import { needsMfaChallenge } from '@/lib/mfa';

// Loaded immediately, increases bundle size
const supabase = getSupabase();
```

**Good** ✅:
```typescript
const handleSubmit = async (e) => {
  // Lazy load only when actually needed
  const { getSupabase } = await import('@/lib/supabase-client');
  const { needsMfaChallenge } = await import('@/lib/mfa');
  
  const supabase = getSupabase();
  // ...
};
```

**Benefits**:
- Faster initial page load
- Smaller initial bundle
- Better mobile performance
- Delayed initialization reduces errors

---

## 📚 Architectural Lessons

### Lesson #1: Critical vs Non-Critical Pages

**Critical Pages** (must work everywhere):
- Login
- Signup  
- Password reset
- Error pages
- Landing page

**Requirements for Critical Pages**:
- ✅ Zero external dependencies
- ✅ Inline styles (no CSS-in-JS)
- ✅ Vanilla JavaScript only
- ✅ Progressive enhancement
- ✅ Graceful degradation
- ✅ Works without JavaScript
- ✅ Emergency fallback available

**Non-Critical Pages** (can use modern features):
- Dashboard
- Admin pages
- Reports
- Settings

**Can Use**:
- External libraries
- Complex state management
- Animations
- Advanced features

---

### Lesson #2: Mobile-First Critical Paths

> If it doesn't work on iPhone Safari, it's broken.

**Why iPhone Safari Matters**:
- Most restrictive browser
- WKWebView has limitations
- If it works on iOS, it works everywhere
- Many business users have iPhones

**iOS Safari Gotchas**:
- Aggressive caching
- Limited LocalStorage
- Restricted Web APIs
- Animation performance issues
- Module loading timing
- Form autofill conflicts

**Testing Priority**:
```
1. iPhone Safari (latest iOS)    ← Test FIRST
2. iPhone Safari (iOS -1)
3. Android Chrome
4. Desktop Safari
5. Desktop Chrome
6. Other browsers
```

---

### Lesson #3: Defensive Data Fetching

**Bad** ❌:
```typescript
// Assumes data will always be available
const response = await fetch('/api/tenant/context');
const data = await response.json();
setContext(data);  // ← What if response is 401?
```

**Good** ✅:
```typescript
const response = await fetch('/api/tenant/context');

// Check status first
if (!response.ok) {
  if (response.status === 401) {
    // Only redirect from protected pages
    if (!isPublicRoute(pathname)) {
      window.location.href = '/login';
    }
    return;
  }
  throw new Error(`HTTP ${response.status}`);
}

const data = await response.json();
setContext(data);
```

**Rule**:
> Never assume API calls succeed. Always handle errors gracefully.

---

### Lesson #4: Error Boundaries for Critical Flows

**Add Error Boundary**:
```typescript
'use client';

export default function LoginErrorBoundary({ children }) {
  const [hasError, setHasError] = React.useState(false);

  React.useEffect(() => {
    const handleError = (error) => {
      console.error('[Login Error]', error);
      setHasError(true);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleError);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleError);
    };
  }, []);

  if (hasError) {
    return (
      <div className="error-fallback">
        <h1>Something went wrong</h1>
        <button onClick={() => window.location.reload()}>
          Reload Page
        </button>
        <a href="/login-static">Emergency Login</a>
      </div>
    );
  }

  return children;
}
```

---

## 🎯 Action Items for Future Development

### Immediate (Next Sprint)

- [ ] **Add comprehensive E2E tests for login flow**
  - Test on real iPhone device
  - Test with/without MFA
  - Test error scenarios
  
- [ ] **Set up automated mobile browser testing**
  - BrowserStack or LambdaTest
  - Test matrix: iOS Safari, Android Chrome
  
- [ ] **Create login page monitoring dashboard**
  - Track login success rate by device
  - Alert on success rate drop
  - Monitor page load time

- [ ] **Document all public routes**
  - Maintain PUBLIC_ROUTES list
  - Update when adding new auth pages
  - Add tests to verify routing

### Short Term (Next Month)

- [ ] **Audit all providers in root layout**
  - Document which ones need auth
  - Convert to conditional wrappers if needed
  
- [ ] **Create provider checklist**
  - Guidelines for adding new providers
  - Review process before merge
  
- [ ] **Add performance budgets**
  - Login page: max 100KB initial bundle
  - Login page: max 2s load time on 3G
  
- [ ] **Create mobile testing workflow**
  - Pre-deployment mobile test checklist
  - Automated CI mobile browser tests

### Long Term (Next Quarter)

- [ ] **Build comprehensive auth testing suite**
  - Unit tests
  - Integration tests
  - E2E tests
  - Performance tests
  
- [ ] **Create design system for critical pages**
  - Reusable components
  - iOS Safari tested
  - Zero external deps
  
- [ ] **Implement progressive web app features**
  - Offline support
  - Service worker
  - App-like experience

---

## 📖 Reference Documentation

### Related Documents
- `docs/troubleshooting/LOGIN_PAGE_MOBILE_SAFARI_ERROR.md` - Initial investigation
- `docs/troubleshooting/LOGIN_PAGE_IOS_SAFARI_FIX_V2.md` - Framer Motion removal
- `scripts/check-required-env.mjs` - Environment validation script

### Key Files Modified
- `src/app/(auth)/login/page.tsx` - Main login page (simplified)
- `src/app/layout.tsx` - Root layout (uses conditional wrapper)
- `src/components/providers/TenantContextWrapper.tsx` - Smart provider wrapper
- `src/app/login-static/page.tsx` - Emergency fallback
- `src/app/api/auth/login-static/route.ts` - Fallback API handler

### Commits
- `a93a667c` - Add error handling for login
- `62e9e9b2` - Remove framer-motion, simplify login  
- `b45e62dd` - **Fix TenantContextProvider infinite loop** ⭐
- `[current]` - Add MFA support with vanilla JS

---

## 🎓 Key Takeaways

### Top 5 Lessons

1. **Test on real devices early** - Emulators don't catch iOS Safari issues
2. **Keep critical pages simple** - No fancy libraries on login/auth pages
3. **Conditional providers** - Don't wrap everything in root layout
4. **Graceful degradation** - Always have a fallback
5. **Monitor production** - Sentry caught the issue, but we need better alerts

### What Went Well ✅
- Sentry detected the error immediately
- Quick iteration on fixes (3 attempts in ~3 hours)
- Good documentation during troubleshooting
- Emergency fallback prevented total outage

### What Could Be Improved ❌
- Should have tested on real iPhone before initial deployment
- Provider architecture wasn't properly reviewed
- No mobile browser testing in CI
- No performance budgets for critical pages

### Quote to Remember
> "If your login page doesn't work, nothing else matters."  
> — Every SRE ever

---

**Document Owner**: Engineering Team  
**Last Updated**: 2026-06-18  
**Review Frequency**: After every auth-related incident  
**Status**: 🟢 **Active** - Must read before modifying auth pages
