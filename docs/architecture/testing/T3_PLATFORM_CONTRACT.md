# T3: Platform Contract Change (Simulated)

**Test ID:** T3  
**Purpose:** Simulate platform contract modification

## Scenario

This file simulates a platform contract change that requires
a consuming product to be updated simultaneously.

**Pattern:** Platform contract + Product consumer coupling

**Example Real Case:**
- Platform: Adding new capability to org-unit.engine.ts
- Product: Consuming the new capability in branch.service.ts

## Contract Change

Added method: `OrgUnitEngine.getHierarchy()`

**Breaking:** No (additive change)  
**Consumers affected:** English Center (branch management)

---

**Test Branch:** platform/test-coupled-exception  
**Date:** 2026-09-13
