# Pull Request

## 📋 Scope Declaration

**Branch:** `[prefix]/[scope-name]`  
**Target:** `main`  
**Type:** 
- [ ] Platform Layer
- [ ] Product Vertical
- [ ] Bug Fix
- [ ] Documentation
- [ ] Infrastructure/Tooling

---

## 🔗 Merge Path

### Dependencies
- [ ] None (independent change)
- [ ] Requires PR #___ (merged)
- [ ] Requires branch ___ (pending merge)

### Scope Boundary

**What this PR contains:**
- 

**What this PR does NOT contain:**
- 

**File Count:** ___ files  
⚠️ If > 50 files, explain why scope requires this size:


---

## 📝 Description

### Problem Statement


### Solution Summary


### Implementation Details

<!-- Technical explanation of changes -->

---

## ✅ Verification Checklist

### Code Quality
- [ ] Build PASS (`npm run build`)
- [ ] Tests PASS (`npm run test`)
- [ ] Linting PASS (`npm run lint`)
- [ ] Type checking PASS (`npm run type-check`)

### Architecture Compliance
- [ ] Architecture Guard PASS (`npm run healthcare:guard` or `npm run logistics:guard`)
- [ ] No Kernel modifications (if applicable)
- [ ] Public Contract adherence verified
- [ ] No `any` types introduced

### Database Changes (if applicable)
- [ ] Migration files follow naming convention
- [ ] Migrations are additive-only (no `DROP`, `ALTER` destructive)
- [ ] Migration reversibility verified
- [ ] RLS policies implemented
- [ ] Foreign key constraints defined

### Security & Data Protection
- [ ] Tenant isolation verified (Gate 0 / P0)
- [ ] No hardcoded secrets or credentials
- [ ] Input validation implemented
- [ ] Authorization checks in place

### Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated (if applicable)
- [ ] Manual testing completed
- [ ] Edge cases covered

### Documentation
- [ ] Code comments added for complex logic
- [ ] README updated (if applicable)
- [ ] Architecture docs updated (if applicable)
- [ ] CHANGELOG entry added

---

## 🧪 Testing Evidence

### Test Results
```
# Paste test output here
```

### Manual Testing
<!-- Describe manual testing performed -->

---

## 🎯 Post-Merge Plan

- [ ] Smoke test on `main` after merge
- [ ] Branch will be auto-deleted
- [ ] Update status to COMPLETE
- [ ] Notify stakeholders (if applicable)

---

## 📊 Impact Assessment

### Affected Components
- 

### Breaking Changes
- [ ] No breaking changes
- [ ] Breaking changes documented below:


### Performance Impact
- [ ] No performance impact
- [ ] Performance impact documented below:


---

## 🔍 Review Notes

<!-- Additional context for reviewers -->

---

## 📚 References

- Related Issue: #___
- Design Doc: 
- Architecture Decision: 
- Related PRs: 

---

## ✋ Reviewer Checklist

- [ ] Code follows project conventions
- [ ] Architecture principles respected
- [ ] Security considerations addressed
- [ ] Tests adequately cover changes
- [ ] Documentation is clear and complete
- [ ] No obvious bugs or issues

---

**📖 Reference:** [Git Workflow Constitution](docs/architecture/GIT_WORKFLOW_CONSTITUTION.md)

---

<!-- 
This PR template enforces the Git Workflow Constitution.
For questions, see docs/architecture/GIT_WORKFLOW_CONSTITUTION.md
-->
