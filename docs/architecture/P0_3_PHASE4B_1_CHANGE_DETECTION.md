# P0.3-PHASE 4B.1: CHANGE DETECTION

**Phase:** Phase 4B.1 — Change Detection  
**Status:** IMPLEMENTATION COMPLETE ✅  
**Prerequisite:** Phase 4B.0 APPROVED ✅

---

## 🎯 OBJECTIVE

Build change detection logic to classify commits and route deployment correctly.

**Input:** Commit range / changed files  
**Output:** Classification flags for routing

**Principle:** Change detection only classifies. BDGF is the policy authority.

---

## 📋 ROUTING MATRIX (LOCKED)

| Change Type | `needs_migration` | `needs_db_verify` | `needs_app_deploy` | `risk_class` |
|-------------|-------------------|-------------------|--------------------|--------------|
| **Docs-only** | `false` | `false` | `false` | `LOW` |
| **App-only** | `false` | `baseline` | `true` | `MEDIUM` |
| **DB-only** | `true` | `true` | `false` | `HIGH` |
| **Mixed** | `true` | `true` | `true` | `HIGH` |
| **Infra/control-plane** | `false`* | `special` | `conditional` | `CRITICAL` |

*Infra changes do not trigger migration executor but require explicit approval gate.

---

## 🔍 FILE PATH CLASSIFICATION

### App Changes (Medium Risk)
```
src/**
app/**
components/**
lib/**
public/**
styles/**
package.json (dependencies only)
package-lock.json
tsconfig.json
next.config.js
tailwind.config.js
postcss.config.js
.env.example (non-sensitive)
```

### DB Migration Artifacts ONLY (High Risk)
```
supabase/migrations/**/*.sql
supabase/seed.sql (if used for production data migration)
```

**IMPORTANT:** Migration artifacts ≠ Migration tooling
- `supabase/migrations/*.sql` = MIGRATION (db_changed)
- `scripts/bdgf/migration-executor.mjs` = TOOLING (infra_changed)

### Infra/Control-Plane Changes (Critical Risk)
```
.github/workflows/**
.github/actions/**
scripts/bdgf/** (ALL BDGF tooling)
scripts/deployment/**
scripts/deploy-*.sh (legacy deployment scripts)
scripts/apply-*.js (legacy migration scripts)
scripts/deploy-migration.js (legacy tooling)
vercel.json
.vercel/**
Dockerfile
docker-compose.yml
```

### Docs Only (Low Risk)
```
docs/**
README.md
*.md (except supabase/migrations/*.md)
LICENSE
.github/ISSUE_TEMPLATE/**
.github/PULL_REQUEST_TEMPLATE.md
```

### Ignore (No Deployment)
```
.gitignore
.editorconfig
.prettierrc
.eslintrc
.vscode/**
*.test.ts
*.test.tsx
*.spec.ts
*.spec.tsx
__tests__/**
e2e/** (test changes, not app changes)
```

---

## 🛠️ IMPLEMENTATION PLAN

### Step 1: Add Change Detection Job

Add new job `detect-changes` to `.github/workflows/deploy-production.yml`:

```yaml
detect-changes:
  name: Detect Changes
  runs-on: ubuntu-latest
  timeout-minutes: 5
  outputs:
    app_changed: ${{ steps.classify.outputs.app_changed }}
    db_changed: ${{ steps.classify.outputs.db_changed }}
    infra_changed: ${{ steps.classify.outputs.infra_changed }}
    docs_only: ${{ steps.classify.outputs.docs_only }}
    needs_migration: ${{ steps.classify.outputs.needs_migration }}
    needs_app_deploy: ${{ steps.classify.outputs.needs_app_deploy }}
    risk_class: ${{ steps.classify.outputs.risk_class }}
  steps:
    - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
      with:
        fetch-depth: 0
    - name: Classify changes
      id: classify
      run: |
        # Get changed files since last deployment
        git fetch origin main
        changed_files=$(git diff --name-only ${{ github.event.before }}..${{ github.sha }} || echo "")
        
        # Classification flags
        app_changed=false
        db_changed=false
        infra_changed=false
        docs_only=true
        
        # Classify each file
        while IFS= read -r file; do
          case "$file" in
            src/*|app/*|components/*|lib/*|public/*|styles/*|\
            package.json|package-lock.json|tsconfig.json|\
            next.config.js|tailwind.config.js|postcss.config.js)
              app_changed=true
              docs_only=false
              ;;
            supabase/migrations/*.sql|scripts/migrations/*)
              db_changed=true
              docs_only=false
              ;;
            .github/workflows/*|.github/actions/*|\
            scripts/bdgf/*|scripts/deployment/*|\
            vercel.json|Dockerfile|docker-compose.yml)
              infra_changed=true
              docs_only=false
              ;;
            docs/*|README.md|*.md|LICENSE|\
            .github/ISSUE_TEMPLATE/*|.github/PULL_REQUEST_TEMPLATE.md)
              # Docs only, no change to flags
              ;;
            *.test.ts|*.test.tsx|*.spec.ts|*.spec.tsx|\
            __tests__/*|e2e/*)
              # Test files, treated as docs
              ;;
            *)
              # Unknown file, treat as app change (fail-safe)
              app_changed=true
              docs_only=false
              ;;
          esac
        done <<< "$changed_files"
        
        # Routing logic
        needs_migration=$db_changed
        needs_app_deploy=$app_changed
        
        # Risk classification
        if [ "$infra_changed" = true ]; then
          risk_class=CRITICAL
        elif [ "$db_changed" = true ]; then
          risk_class=HIGH
        elif [ "$app_changed" = true ]; then
          risk_class=MEDIUM
        elif [ "$docs_only" = true ]; then
          risk_class=LOW
        else
          risk_class=UNKNOWN
        fi
        
        # Output
        echo "app_changed=$app_changed" >> $GITHUB_OUTPUT
        echo "db_changed=$db_changed" >> $GITHUB_OUTPUT
        echo "infra_changed=$infra_changed" >> $GITHUB_OUTPUT
        echo "docs_only=$docs_only" >> $GITHUB_OUTPUT
        echo "needs_migration=$needs_migration" >> $GITHUB_OUTPUT
        echo "needs_app_deploy=$needs_app_deploy" >> $GITHUB_OUTPUT
        echo "risk_class=$risk_class" >> $GITHUB_OUTPUT
        
        # Log classification
        echo "::notice::Change classification: app=$app_changed db=$db_changed infra=$infra_changed docs=$docs_only risk=$risk_class"
```

### Step 2: Update Existing Jobs to Depend on Classification

**Current job structure:**
```
validate → preview → smoke → promote → verify
```

**New job structure:**
```
detect-changes
      ↓
validate (skip if docs_only)
      ↓
preview (skip if docs_only)
      ↓
smoke (skip if docs_only)
      ↓
promote (skip if docs_only)
      ↓
verify (skip if docs_only)
```

Add condition to each existing job:
```yaml
validate:
  needs: detect-changes
  if: needs.detect-changes.outputs.docs_only != 'true'
  # ... rest of job
```

### Step 3: Test Change Detection

**Test scenarios:**

1. **Docs-only change:**
   - Modify `docs/architecture/README.md`
   - Expected: `docs_only=true`, all other `false`, `risk_class=LOW`
   - Deployment: SKIP

2. **App-only change:**
   - Modify `src/components/Button.tsx`
   - Expected: `app_changed=true`, `needs_app_deploy=true`, `risk_class=MEDIUM`
   - Deployment: App deploy only (no migration)

3. **DB-only change:**
   - Add `supabase/migrations/20260825000000_test.sql`
   - Expected: `db_changed=true`, `needs_migration=true`, `risk_class=HIGH`
   - Deployment: Migration only (no app deploy)

4. **Mixed change:**
   - Modify `src/lib/db.ts` + `supabase/migrations/20260825000001_test.sql`
   - Expected: `app_changed=true`, `db_changed=true`, both `needs_*=true`, `risk_class=HIGH`
   - Deployment: Migration first, then app deploy

5. **Infra change:**
   - Modify `.github/workflows/deploy-production.yml`
   - Expected: `infra_changed=true`, `risk_class=CRITICAL`
   - Deployment: Explicit approval required

---

## ✅ DEFINITION OF DONE (4B.1)

Phase 4B.1 is **COMPLETE** when:

- [x] `detect-changes` job added to workflow
- [x] File path classification logic implemented
- [x] Routing matrix outputs correct flags
- [x] Existing jobs conditional on classification
- [ ] Test scenario 1 (docs-only) PASS
- [ ] Test scenario 2 (app-only) PASS
- [ ] Test scenario 3 (DB-only) PASS
- [ ] Test scenario 4 (mixed) PASS
- [ ] Test scenario 5 (infra) PASS
- [ ] No production deployment triggered during testing

---

## 📊 IMPLEMENTATION STATUS

**Completed:**
- ✅ Added `detect-changes` job as first job in workflow
- ✅ Implemented file classification with fail-closed behavior
- ✅ Implemented routing matrix (docs/app/DB/mixed/infra)
- ✅ Added risk classification (LOW/MEDIUM/HIGH/CRITICAL)
- ✅ Made all existing jobs conditional on `docs_only != 'true'`
- ✅ Added deterministic commit range detection
- ✅ Added unknown file handling (fail-closed to app_changed)
- ✅ Added comprehensive logging

**Implementation Details:**

1. **Commit Range Detection:**
   - First push/workflow_dispatch: `HEAD^..HEAD`
   - Normal push: `github.event.before..github.sha`
   - Fail-closed: Empty range → ERROR

2. **File Classification:**
   - App: `src/**, app/**, components/**, lib/**, package.json, *.config.*`
   - DB: `supabase/migrations/**.sql, scripts/deploy-*.sh, scripts/apply-*.js, scripts/bdgf/migration-executor.mjs`
   - Infra: `.github/workflows/**, scripts/bdgf/gate-*.mjs, vercel.json, Dockerfile`
   - Docs: `docs/**, README.md, *.md, LICENSE`
   - Test/ignore: `*.test.ts, __tests__/**, e2e/**, .gitignore, .vscode/**`

3. **Routing Logic:**
   - `needs_migration = db_changed`
   - `needs_app_deploy = app_changed`
   - Unknown files → fail-closed to `app_changed=true`

4. **Risk Classification:**
   - `CRITICAL` if infra changed
   - `HIGH` if DB changed
   - `MEDIUM` if app changed
   - `LOW` if docs only
   - ERROR if unable to determine

**Next:** Test 5 scenarios on feature branch

---

## 🚨 CONSTRAINTS

**Allowed:**
- ✅ Modify `.github/workflows/deploy-production.yml`
- ✅ Add inline shell script for classification logic

**Forbidden:**
- ❌ Invoke migration executor (Phase 4B.2)
- ❌ Invoke BDGF policy engine (Phase 4B.2)
- ❌ Trigger production deployment
- ❌ Modify legacy paths

**Testing:**
- All tests on feature branch (`p0.3-phase4b.1-change-detection`)
- Use `workflow_dispatch` for testing (non-production)
- NO production mutation

---

## 📊 STATUS

**Current:** Ready to implement  
**Next Step:** Add `detect-changes` job to workflow  
**Blocking Issues:** None

---

**END OF PHASE 4B.1 PLAN**
