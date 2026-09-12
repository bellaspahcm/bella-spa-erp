# P2.3 Browser Runtime — Test Plan

**Objective:** Verify browser UI invokes the hardened create path

**NOT testing:** "Does UI exist?" or "Does UI look nice?"  
**TESTING:** "Does UI invoke createProductAction → ProductService.createProduct?"

---

## Test Strategy

### B1: Browser Invocation Path

**Evidence type:** Runtime network/console trace

**What to verify:**
1. Browser form submission calls `createProductAction`
2. Action invokes `ProductService.createProduct`
3. Service enforces Layer 5 validation
4. Success response returns created product

**Method:**
- Create minimal test page (or use existing if available)
- Submit product creation form in browser
- Capture network/console evidence showing:
  - POST to action endpoint
  - Service layer execution (console logs)
  - Database write (success response)

---

## Acceptance Criteria

```text
✅ Browser form → createProductAction() → VERIFIED
✅ createProductAction → ProductService.createProduct() → VERIFIED
✅ Product created with correct tenant_id → VERIFIED
✅ Layer 5 validation executed → VERIFIED

Result: UI uses hardened path (NOT direct DB bypass)
```

---

## Implementation Options

### Option A: Use Existing UI
If real estate product UI already exists, use it directly.

### Option B: Create Minimal Test UI
If no UI exists, create minimal test page for evidence only:
- `/app/test-product-creation/page.tsx`
- Form with project selection + product fields
- Calls `createProductAction`
- Shows success/error

### Option C: Manual Browser Console Test
If no time for UI, use browser console:
```javascript
await fetch('/api/actions/createProduct', {
  method: 'POST',
  body: JSON.stringify({...})
})
```

---

## Decision

**Priority:** Evidence over UI polish

If existing UI calls the action: use it and verify path.  
If no UI exists: create minimal evidence UI (Option B).  
If time constrained: browser console test (Option C).

---

**Status:** ▶️ PLANNING  
**Next:** Implement chosen option → Capture evidence → Document B1 result

