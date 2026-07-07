# UI Migration Plan: Salary Config Tab

**Status:** PLANNED (not yet implemented)  
**Reason:** Code file too large for single update, requires careful refactor  

---

## Current State

**File:** `src/app/dashboard/settings/components/SalaryConfigTab.tsx` (v1.4.0)

**Data Source:** `generalSettings.salary_config` (tenant settings table - old approach)

**UI Components:**
- ✅ Thưởng chất lượng (Rating bonuses: 5★, 4.5★, 4★)
- ✅ Thưởng KPI (Target sessions → Bonus)
- ✅ Phạt kỷ luật (Late penalty, Absent penalty)
- ✅ Auto consume inventory toggle

---

## Target State

**File:** `src/app/dashboard/settings/components/SalaryConfigTab.tsx` (v2.0.0)

**Data Source:** `tenant_payroll_config` table (configuration-driven approach)

**Changes:**
1. **Props:** Remove `generalSettings`, `setGeneralSettings` → Add `tenantId`
2. **State:** Add local state for KPI, Attendance, Rating configs
3. **Load:** Use `loadKPIConfig()`, `loadAttendanceConfig()`, `loadRatingConfig()`
4. **Save:** Use `saveKPIConfig()`, `saveAttendanceConfig()`, `saveRatingConfig()`
5. **UI:** Add Enable/Disable toggle for each provider
6. **UI:** Keep existing design (already beautiful)

---

## Implementation Steps

### Step 1: Create Actions (✅ DONE)

**File:** `src/services/payroll-config-actions.ts`

**Functions:**
- `loadProviderConfig(tenantId, providerKey)` - Load single config
- `loadAllProviderConfigs(tenantId)` - Load all configs
- `saveProviderConfig(params)` - Save config
- `toggleProviderEnabled(tenantId, providerKey, enabled)` - Toggle on/off
- Helper functions: `loadKPIConfig()`, `saveKPIConfig()`, etc.

### Step 2: Update SalaryConfigTab Component

**New Props:**
```typescript
interface SalaryConfigTabProps {
  tenantId: string; // Changed from generalSettings
}
```

**New State:**
```typescript
// Loading
const [isLoading, setIsLoading] = useState(true);
const [isSaving, setIsSaving] = useState(false);

// KPI Config
const [kpiEnabled, setKpiEnabled] = useState(false);
const [kpiTarget, setKpiTarget] = useState(30);
const [kpiBonus, setKpiBonus] = useState(1000000);

// Attendance Config
const [attendanceEnabled, setAttendanceEnabled] = useState(true);
const [latePenalty, setLatePenalty] = useState(50000);
const [absentPenalty, setAbsentPenalty] = useState(200000);
const [lateGracePeriod, setLateGracePeriod] = useState(15);

// Rating Config
const [ratingEnabled, setRatingEnabled] = useState(false);
const [minRating, setMinRating] = useState(4.5);
const [ratingBonus, setRatingBonus] = useState(50000);
```

**Load Function:**
```typescript
useEffect(() => {
  loadConfigs();
}, [tenantId]);

async function loadConfigs() {
  setIsLoading(true);
  try {
    // Load KPI
    const kpiResult = await loadKPIConfig(tenantId);
    if (kpiResult.success) {
      setKpiEnabled(kpiResult.data.enabled);
      const config = kpiResult.data.config as KPIThresholdConfig;
      setKpiTarget(config.target || 30);
      setKpiBonus(config.bonus || 1000000);
    }

    // Load Attendance
    const attendanceResult = await loadAttendanceConfig(tenantId);
    if (attendanceResult.success) {
      setAttendanceEnabled(attendanceResult.data.enabled);
      const config = attendanceResult.data.config as AttendanceCombinedConfig;
      setLatePenalty(config.latePenalty || 50000);
      setAbsentPenalty(config.absentPenalty || 200000);
      setLateGracePeriod(config.lateGracePeriod || 15);
    }

    // Load Rating
    const ratingResult = await loadRatingConfig(tenantId);
    if (ratingResult.success) {
      setRatingEnabled(ratingResult.data.enabled);
      const config = ratingResult.data.config as RatingThresholdConfig;
      setMinRating(config.minRating || 4.5);
      setRatingBonus(config.bonus || 50000);
    }
  } catch (error) {
    toast.error('Không thể tải cấu hình lương');
  } finally {
    setIsLoading(false);
  }
}
```

**Save Function:**
```typescript
async function handleSave() {
  setIsSaving(true);
  try {
    // Save KPI
    await saveKPIConfig(tenantId, kpiEnabled, 'threshold', {
      target: kpiTarget,
      bonus: kpiBonus,
      metric: 'sessions'
    });

    // Save Attendance
    await saveAttendanceConfig(tenantId, attendanceEnabled, 'late_deduction', {
      latePenalty,
      absentPenalty,
      lateGracePeriod
    });

    // Save Rating
    await saveRatingConfig(tenantId, ratingEnabled, 'threshold', {
      minRating,
      bonus: ratingBonus
    });

    toast.success('Đã lưu cấu hình lương thành công!');
  } catch (error: any) {
    toast.error(error.message || 'Không thể lưu cấu hình');
  } finally {
    setIsSaving(false);
  }
}
```

### Step 3: Update UI Components

**Add Enable/Disable Toggles:**
- Rating section: Add toggle in header
- KPI section: Add toggle in header
- Attendance section: Add toggle in header

**Example Toggle Component:**
```tsx
<label className="relative inline-flex items-center cursor-pointer">
  <input
    type="checkbox"
    checked={kpiEnabled}
    onChange={(e) => setKpiEnabled(e.target.checked)}
    className="sr-only peer"
  />
  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
</label>
```

**Disable Inputs When Provider Disabled:**
```tsx
<input
  type="number"
  value={kpiTarget}
  onChange={(e) => setKpiTarget(parseIntegerInput(e.target.value, { min: 0, max: 500 }))}
  disabled={!kpiEnabled} // Add this
  className="... disabled:opacity-50" // Add this
/>
```

### Step 4: Update Parent Component

**File:** `src/app/dashboard/settings/page.tsx`

**Change:**
```tsx
// OLD:
<SalaryConfigTab 
  generalSettings={generalSettings}
  setGeneralSettings={setGeneralSettings}
/>

// NEW:
<SalaryConfigTab 
  tenantId={currentTenantId} // Get from context/session
/>
```

---

## Migration Strategy

### Option A: Big Bang (NOT RECOMMENDED)
- Replace entire file at once
- Risk: High (may break existing UI)
- Rollback: Difficult

### Option B: Feature Flag (RECOMMENDED)
- Add `use_new_salary_config` flag to tenant settings
- If true: Use new configuration system
- If false: Use old `generalSettings` approach
- Allow gradual migration tenant by tenant

### Option C: Parallel Systems
- Keep old SalaryConfigTab as `SalaryConfigTab_Legacy.tsx`
- Create new `SalaryConfigTab_v2.tsx`
- Switch in settings page based on feature flag
- Delete legacy after full migration

---

## Testing Checklist

- [ ] Load config from `tenant_payroll_config` table
- [ ] Save config to `tenant_payroll_config` table
- [ ] Enable/Disable toggles work correctly
- [ ] Input validation works
- [ ] Toast notifications display
- [ ] Page revalidation works
- [ ] Multiple tenants don't interfere
- [ ] Cache invalidation works (5-min TTL)

---

## Rollback Plan

If migration fails:
1. Revert `SalaryConfigTab.tsx` to v1.4.0
2. Remove `payroll-config-actions.ts`
3. Keep database tables (no harm)
4. Document lessons learned

---

## Timeline

**Estimated:** 2-3 hours

1. **Hour 1:** Update SalaryConfigTab component code
2. **Hour 2:** Update parent component, test UI
3. **Hour 3:** E2E testing, fix bugs, commit

---

## Next Steps

1. **Complete SalaryConfigTab migration** (this document)
2. **Test with real tenant data**
3. **Add strategy selector** (advanced feature - Week 3)
4. **Build Commission Settings UI** (similar pattern)
5. **Document for team**

---

## Status

**Current:** Actions layer complete ✅  
**Next:** UI component migration (blocked by file size limit)  
**Workaround:** Create new file instead of editing existing  

