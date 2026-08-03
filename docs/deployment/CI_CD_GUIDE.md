# CI/CD Pipeline Guide

## 📋 Overview

GitHub Actions pipeline for Real Estate module with automated testing and deployment.

**Pipeline:** `.github/workflows/ci-real-estate.yml`

---

## 🔄 Workflow Triggers

| Event | Branches | Jobs Run |
|-------|----------|----------|
| Push | `main`, `develop` | All jobs |
| Pull Request | `main`, `develop` | Quality, Test, Build, E2E |
| Manual | Any | Selected jobs |

**Watched Paths:**
- `src/modules/real_estate/**`
- `src/app/dashboard/real-estate/**`
- `supabase/migrations/**`

---

## 🎯 Pipeline Jobs

### 1. Code Quality & Security (2-3 min)
- ESLint
- TypeScript type check
- npm audit (security)
- Secret leak detection

### 2. Unit Tests (3-5 min)
- Run Jest tests
- Generate coverage report
- Upload to Codecov

### 3. Build Verification (5-7 min)
- `npm run build`
- Verify `.next` directory
- Check for build errors

### 4. E2E Tests (10-15 min) *PR to main only*
- Playwright tests
- Critical flows (booking, leads)
- Upload test reports

### 5. Migration Validation (2-3 min)
- Spin up PostgreSQL
- Run migrations (dry run)
- Verify schema

### 6. Deploy to Staging (5-7 min) *Auto on develop*
- Deploy to Vercel
- Run smoke tests
- Health checks

### 7. Deploy to Production (5-7 min) *Manual on main*
- Deploy to Vercel
- Create Sentry release
- Post-deployment verification

### 8. Verify Production (2-3 min)
- Health checks
- Smoke tests
- Monitor errors

**Total Time:**
- PR: ~20-30 minutes
- Staging deploy: ~25-35 minutes
- Production deploy: ~30-40 minutes

---

## 🔧 Setup Instructions

### 1. GitHub Secrets

Add these secrets in **Settings → Secrets → Actions**:

```
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJxxx...
TEST_SUPABASE_URL=https://test-xxx.supabase.co
TEST_SUPABASE_ANON_KEY=eyJxxx...

# Vercel
VERCEL_TOKEN=xxx
VERCEL_ORG_ID=xxx
VERCEL_PROJECT_ID=xxx

# Sentry
SENTRY_AUTH_TOKEN=xxx
SENTRY_ORG=your-org
SENTRY_PROJECT=your-project
```

### 2. Enable GitHub Actions
1. Go to **Settings → Actions → General**
2. Enable "Allow all actions and reusable workflows"
3. Enable "Read and write permissions"

### 3. Configure Environments
Create environments in **Settings → Environments**:

**Staging:**
- No approval required
- Auto-deploy on `develop` push

**Production:**
- Required reviewers: [Your team]
- Manual approval required

---

## 🚀 Deployment Flow

### Staging (Automatic)
```
develop branch → Push → CI passes → Auto deploy to staging
```

### Production (Manual)
```
main branch → Push → CI passes → Manual approval → Deploy to production
```

---

## 🐛 Troubleshooting

### Build Fails: "Module not found"
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

### E2E Tests Fail: "Timeout"
- Check `PLAYWRIGHT_TEST_BASE_URL` is correct
- Verify test database has seed data
- Increase timeout in `playwright.config.ts`

### Migration Validation Fails
- Check SQL syntax in migration files
- Verify dependencies (tables exist before FK)
- Test locally: `psql -f migration.sql`

### Deployment Fails: "Vercel token invalid"
- Regenerate Vercel token
- Update `VERCEL_TOKEN` secret
- Ensure token has correct scopes

---

## 📊 Monitoring

### View Pipeline Status
- **GitHub Actions tab**: See all runs
- **PR checks**: See status inline
- **Branch protection**: Require passing checks

### Coverage Reports
- Automatically uploaded to Codecov
- View at: `https://codecov.io/gh/your-org/bella-spa-erp`

### Sentry Releases
- Auto-created on production deploy
- Track errors by release version
- View at: Sentry Dashboard → Releases

---

## 🔒 Security Best Practices

✅ **Do:**
- Use GitHub Secrets for credentials
- Rotate tokens regularly
- Limit token scopes
- Enable branch protection

❌ **Don't:**
- Commit secrets to code
- Use production keys in tests
- Skip security audits
- Deploy without approval

---

## 📖 Related Docs
- Environment Setup: `docs/deployment/ENVIRONMENT_SETUP.md`
- Deployment Checklist: `docs/deployment/PRODUCTION_DEPLOYMENT_CHECKLIST.md`
- Testing Guide: `docs/real-estate/E2E_TESTING_GUIDE.md`
