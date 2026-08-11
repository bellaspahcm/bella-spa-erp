# Pull Request

## Description
<!-- Brief description of what this PR does -->

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Refactor (code improvement without changing functionality)
- [ ] Documentation update

---

## Platform Architecture Compliance (Real Estate Refactor)

**Zero New Legacy Debt Checklist:**
- [ ] Does NOT add new files to `src/services` (Real Estate context)
- [ ] Does NOT create new custom tables without architectural justification
- [ ] Does NOT bypass platform layer (direct DB queries must be documented)
- [ ] DOES use Host Platform primitives where applicable

**Platform Primitives Used (check all that apply):**
- [ ] Person Center (`persons` + `party_roles`)
- [ ] Organization Center (`organization_units`)
- [ ] Document Management (`documents`)
- [ ] Notification Hub (`notifications`)
- [ ] None (not applicable)

**If adding Real Estate features:**
- **Platform primitive used:** _[specify which primitive]_
- **Architectural justification:** _[explain why this approach]_
- **Architecture reviewer:** _[@mention reviewer]_

**For refactor PRs:**
- **Legacy component being migrated:** _[e.g., re_customers → Person Center]_
- **Estimated effort:** _[hours]_
- **Actual effort:** _[hours]_ (fill after completion)
- **Expected impact:** _[e.g., structural reuse improvement]_

---

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] E2E tests added/updated (if applicable)
- [ ] All tests passing locally

**Test coverage:**
- [ ] New code has >80% test coverage
- [ ] Critical paths tested

---

## Database Changes
- [ ] No database changes
- [ ] New migration added (requires architecture review)
- [ ] Migration is additive only (no breaking changes)
- [ ] Rollback strategy documented

**If migration added:**
- **Migration file:** _[filename]_
- **Tables affected:** _[list tables]_
- **Rollback plan:** _[describe rollback strategy]_

---

## Deployment Notes
- [ ] No special deployment steps required
- [ ] Feature flag created (specify): _[flag name]_
- [ ] Requires data migration (document in PR description)
- [ ] Requires configuration changes

---

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated (if applicable)
- [ ] No console.log() or debugging code left
- [ ] Architecture Gate CI passing (if applicable)

---

## Related Issues
<!-- Link related issues: Fixes #123, Relates to #456 -->

---

## Screenshots (if applicable)
<!-- Add screenshots for UI changes -->

---

## Additional Notes
<!-- Any additional context, concerns, or discussion points -->
