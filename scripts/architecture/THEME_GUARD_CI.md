# THEME GUARD - CI/CD INTEGRATION

Automated theme architecture enforcement in Git and CI pipelines.

---

## 🎯 Goals

1. **Prevent new violations** from being introduced
2. **Track progress** on fixing existing violations  
3. **Enforce compliance** before code reaches production

---

## 🔧 Integration Status

### ✅ Git Pre-Commit Hook

**Location:** `.husky/pre-commit`

**Behavior:**
- Runs `npm run theme:guard` before every commit
- **Currently non-blocking** (WARN mode)
- Will become blocking when baseline reaches 0 violations

**Manual bypass** (use sparingly):
```bash
git commit --no-verify -m "message"
```

---

### ✅ GitHub Actions CI

**Location:** `.github/workflows/theme-guard.yml`

**Triggers:**
- Pull requests touching CSS/component files
- Push to `main` or `develop` branches

**Behavior:**
- Runs theme guard on every PR
- Posts comment with violation summary
- **Currently non-blocking** (allows merge with warnings)
- Will become blocking when baseline reaches 0

**Manual workflow run:**
```bash
# Trigger manually from GitHub Actions UI
# Or via gh CLI:
gh workflow run theme-guard.yml
```

---

## 📊 Current Status

**Baseline (2026-09-10):**
- BLOCK violations: 108
- WARN violations: 12

**Mode:** Non-blocking (WARN only)

**Transition Plan:**
1. ✅ Phase 1A: Fix critical violations (broad selectors) → Target: ≤80 BLOCK
2. 🔄 Phase 1B: Fix remaining violations → Target: 0 BLOCK
3. 🎯 Enable blocking mode → Prevent all future violations

---

## 🚀 Usage

### Local Development

**Run guard manually:**
```bash
npm run theme:guard
```

**Run with verbose output:**
```bash
npm run theme:guard:verbose
```

**Skip guard for emergency fix:**
```bash
git commit --no-verify -m "Emergency fix"
```

---

### CI Pipeline

**View results:**
- Check PR comments for violation summary
- Check GitHub Actions logs for full report

**If guard fails on CI:**
1. Pull latest changes
2. Run `npm run theme:guard` locally
3. Fix violations following [Theme Guard README](./THEME_GUARD_README.md)
4. Commit fixes
5. Push again

---

## 🔄 Updating Baseline

When violations are fixed, update documentation:

**1. Run guard:**
```bash
npm run theme:guard > theme-guard-current.txt 2>&1
```

**2. Update progress report:**
Edit `docs/architecture/THEME_GUARD_PROGRESS_REPORT.md` with new metrics.

**3. Commit baseline update:**
```bash
git add docs/architecture/THEME_GUARD_PROGRESS_REPORT.md
git commit -m "chore: update theme guard baseline"
```

---

## ⚡ Enabling Blocking Mode

**When to enable:** After baseline reaches 0 BLOCK violations

**Steps:**

**1. Update pre-commit hook:**
```bash
# Edit .husky/pre-commit
# Change from:
npm run theme:guard --silent || echo "⚠️  Non-blocking..."

# To:
npm run theme:guard || exit 1
```

**2. Update GitHub Actions:**
```yaml
# Edit .github/workflows/theme-guard.yml
# Change:
continue-on-error: true

# To:
continue-on-error: false
```

**3. Announce to team:**
```
🎉 Theme Guard is now ENFORCED!

All new commits must pass theme architecture checks.
No more CSS leakage between tenants allowed.

See: scripts/architecture/THEME_GUARD_README.md
```

---

## 🛠️  Troubleshooting

### Guard fails but violations look correct

**Possible causes:**
- Guard logic may need refinement
- False positive in detection rules

**Solution:**
1. Check if it's a false positive by reviewing [guard rules](./THEME_GUARD_README.md)
2. If legitimate issue, fix the code
3. If false positive, create GitHub issue with example

---

### Guard passes locally but fails on CI

**Possible causes:**
- Different Node.js version
- Cached dependencies

**Solution:**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run theme:guard
```

---

### Need to disable guard temporarily

**For single commit:**
```bash
git commit --no-verify -m "message"
```

**For entire branch (NOT recommended):**
```bash
# Remove theme guard from .husky/pre-commit temporarily
# Remember to restore it before merging!
```

---

## 📚 References

- [Guard Documentation](./THEME_GUARD_README.md)
- [Progress Report](../../docs/architecture/THEME_GUARD_PROGRESS_REPORT.md)
- [Baseline Report](../../docs/architecture/THEME_GUARD_BASELINE_REPORT.md)
- [Architecture Analysis](../../docs/architecture/ARCHITECTURE_GATE_RESULT_TENANT_THEME_ISOLATION.md)

---

**Maintained by:** BELLA Architecture Team  
**Status:** Active - WARN Mode  
**Last Updated:** 2026-09-10
