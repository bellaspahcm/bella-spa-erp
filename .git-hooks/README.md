# Bella Platform - Git Hooks

Security Gate enforcement hooks for maintaining architectural invariants.

## Available Hooks

### `pre-commit.example`

Runs architectural invariant tests before allowing commit.

**Checks:**
- ✅ Production Type Safety (no `any` types)
- ✅ RLS Tenant Isolation
- ✅ Healthcare Contract Boundary
- ✅ UI Persistence Boundary
- ✅ Build Integrity
- ✅ TypeScript errors

**Install:**
```bash
cp .git-hooks/pre-commit.example .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

**Usage:**
```bash
# Normal commit (runs checks automatically)
git commit -m "feat: add feature"

# Bypass checks (NOT RECOMMENDED - requires architect approval)
git commit --no-verify -m "wip: work in progress"
```

## Why Use Pre-Commit Hooks?

**Before hooks:**
```
Developer commits
    ↓
Push to remote
    ↓
CI runs tests
    ↓
❌ Invariant violation found
    ↓
PR blocked
    ↓
Fix + force push
    ↓
Wasted time + CI resources
```

**With hooks:**
```
Developer commits
    ↓
Pre-commit hook runs
    ↓
❌ Invariant violation found locally
    ↓
Fix immediately
    ↓
Commit succeeds
    ↓
Push to remote (already clean)
```

**Benefits:**
- ⚡ Instant feedback (seconds vs minutes)
- 💰 Saves CI/CD resources
- 🎯 Catches issues before they leave your machine
- 🔒 Maintains baseline security checkpoint

## Bypass Policy

**When bypass is acceptable:**
- ❌ Never for production branches
- ❌ Never for invariant violations
- ⚠️  Only for WIP commits on feature branches
- ⚠️  Only with architect approval for exceptional cases

**How to bypass:**
```bash
git commit --no-verify -m "wip: incomplete feature"
```

**Note:** CI will still catch violations. Bypass only delays the check, doesn't remove it.

## Troubleshooting

### Hook not running

```bash
# Check if hook is executable
ls -la .git/hooks/pre-commit

# If not, make it executable
chmod +x .git/hooks/pre-commit
```

### Hook failing unexpectedly

```bash
# Run tests manually to see full output
npm test -- production-runtime-integrity

# Run TypeScript check manually
npm run type-check
```

### Disable hook temporarily

```bash
# Rename the hook
mv .git/hooks/pre-commit .git/hooks/pre-commit.disabled

# Re-enable later
mv .git/hooks/pre-commit.disabled .git/hooks/pre-commit
```

## Integration with Husky

If using Husky for hook management:

```bash
# Install Husky
npm install --save-dev husky

# Initialize
npx husky init

# Add pre-commit hook
echo "npm test -- production-runtime-integrity" > .husky/pre-commit
echo "npm run type-check" >> .husky/pre-commit
```

## Reference

- Security Reconciliation: `docs/security/SECURITY_RECONCILIATION_2026-08-16.md`
- Invariant Tests: `src/__tests__/invariants/production-runtime-integrity.test.ts`
- CI Workflow: `.github/workflows/security-gate.yml.example`
