# Login Page Error on Mobile Safari (iPhone iOS 18.7)

## Issue Description

**Sentry Error Report**:
- **URL**: `https://bella-spa-erp.vercel.app/login`
- **Device**: iPhone, iOS 18.7, Mobile Safari/WKWebView
- **Error**: Unhandled exception (`auto.browser.global_handlers.onerror`)
- **Transaction**: `/login`
- **Environment**: vercel-production
- **Handled**: No (unhandled error)

## Root Causes

### 1. Missing Supabase Environment Variables (Most Likely)

The login page requires these environment variables on the **client-side**:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`

If these are not set in Vercel's production environment, the `requireSupabasePublicEnv()` function will throw an error when the page loads.

**Check Vercel Environment Variables**:
1. Go to Vercel Dashboard → Project Settings → Environment Variables
2. Verify these variables are set for **Production** environment
3. Ensure they start with `NEXT_PUBLIC_` prefix (required for client-side access in Next.js)

### 2. Browser Compatibility Issues

Mobile Safari and WKWebView on iOS sometimes have issues with:
- Module loading timing
- `process.env` access in client-side code
- Service worker conflicts
- Aggressive caching

## Fix Applied (2026-06-18)

### Code Changes in `src/app/(auth)/login/page.tsx`:

1. **Added initialization error checking**:
   ```typescript
   const [initError, setInitError] = useState<string | null>(null);
   
   useEffect(() => {
     try {
       getSupabase(); // Try to initialize
     } catch (err) {
       setInitError(err.message);
     }
   }, []);
   ```

2. **User-friendly error UI**:
   - Shows clear error message when Supabase client fails to initialize
   - Provides "Reload" button for recovery
   - Prevents unhandled exceptions from reaching global error handler

3. **Try-catch wrapper in handleLogin**:
   - Catches all errors during login process
   - Displays errors in UI instead of crashing

## Verification Steps

### 1. Check Vercel Environment Variables

```bash
# Using Vercel CLI
vercel env ls

# Expected output should include:
# NEXT_PUBLIC_SUPABASE_URL
# NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)
```

If missing, add them:

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY production
```

Then redeploy:

```bash
vercel --prod
```

### 2. Test on Mobile Safari

Open Safari on iPhone:
1. Clear browser cache (Settings → Safari → Clear History and Website Data)
2. Navigate to `https://bella-spa-erp.vercel.app/login`
3. Check if error UI appears or if login form loads correctly

### 3. Check Sentry

Monitor Sentry dashboard for:
- Reduced occurrences of `auto.browser.global_handlers.onerror` on `/login`
- New errors with more descriptive messages (from our error handling)

## Additional Debugging

### Enable Debug Logging

Add this to `src/lib/supabase-client.ts`:

```typescript
export const getSupabase = (): TypedSupabaseClient => {
  if (supabaseInstance) return supabaseInstance;

  const { url, publicKey } = requireSupabasePublicEnv();
  
  // Debug log (remove in production)
  console.log('[Supabase Init] URL exists:', !!url);
  console.log('[Supabase Init] Key exists:', !!publicKey);
  
  supabaseInstance = createBrowserClient<Database>(url, publicKey);
  return supabaseInstance;
};
```

### Check Browser Console

On iPhone:
1. Connect iPhone to Mac
2. Open Safari → Develop → [Your iPhone] → [bella-spa-erp]
3. Check console for error messages

## Prevention

### CI/CD Check

Add environment variable validation to build process:

```typescript
// scripts/check-required-env.mjs
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

console.log('✅ All required environment variables are set');
```

Add to `package.json`:

```json
{
  "scripts": {
    "build": "npm run env:check && next build",
    "env:check": "node scripts/check-required-env.mjs"
  }
}
```

## Related Files

- `src/app/(auth)/login/page.tsx` - Login page component (fixed)
- `src/lib/supabase-client.ts` - Supabase client initialization
- `src/lib/supabase-public-env.ts` - Environment variable validation
- `.env.local` - Local environment variables (not committed)
- Vercel Dashboard - Production environment variables

## References

- [Next.js Environment Variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
- [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables)
- [Supabase Client Configuration](https://supabase.com/docs/reference/javascript/initializing)
- Sentry Error: Transaction `/login`, Mechanism `auto.browser.global_handlers.onerror`

---

**Status**: Fix deployed to production (commit a93a667c)  
**Next Steps**: Monitor Sentry for 24-48 hours to confirm fix effectiveness
