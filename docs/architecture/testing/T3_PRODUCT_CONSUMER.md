# T3: Product Consumer Change (Simulated)

**Test ID:** T3  
**Purpose:** Simulate product consuming new platform capability

## Scenario

This file simulates a product (English Center) consuming
a new platform contract capability.

**Pattern:** Product consumer of platform contract

**Example Real Case:**
- Product: src/products/bella-english-center/branch.service.ts
- Consumes: OrgUnitEngine.getHierarchy() (new capability)

## Consumer Implementation

`branch.service.ts` now calls `getHierarchy()` to display
branch organizational structure.

**Why Coupled:** Cannot split into 2 PRs because:
1. Contract without consumer = dead code
2. Consumer without contract = compilation failure
3. Deployed together = atomic change

---

**Test Branch:** platform/test-coupled-exception  
**Date:** 2026-09-13
