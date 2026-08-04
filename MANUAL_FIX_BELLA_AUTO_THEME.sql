-- ============================================================================
-- Fix Bella Auto Module Theme Colors & Enabled Modules
-- Issue: Bella Auto tenant showing pink/navy colors instead of cyan/teal
-- Date: 2026-08-04
-- ============================================================================

-- ============================================================================
-- Step 1: Identify Bella Auto tenants
-- ============================================================================
SELECT 
  id,
  name,
  enabled_modules,
  brand_theme->>'primaryColor' as current_primary,
  brand_theme->>'stylePreset' as current_preset
FROM tenants
WHERE 
  -- Find tenants with bella_auto enabled
  (enabled_modules->>'bella_auto')::boolean = true
  OR name ILIKE '%auto%'
  OR name ILIKE '%ô tô%';

-- ============================================================================
-- Step 2: Update Bella Auto tenant theme to Ocean Clean (Cyan/Teal)
-- ============================================================================

-- Option A: Update specific tenant by ID (RECOMMENDED - replace 'your-tenant-id')
UPDATE tenants
SET 
  enabled_modules = jsonb_set(
    COALESCE(enabled_modules, '{}'::jsonb),
    '{bella_auto}',
    'true'::jsonb
  ),
  brand_theme = jsonb_set(
    jsonb_set(
      jsonb_set(
        COALESCE(brand_theme, '{}'::jsonb),
        '{primaryColor}',
        '"#0891b2"'::jsonb  -- Cyan 600
      ),
      '{accentColor}',
      '"#14b8a6"'::jsonb  -- Teal 500
    ),
    '{stylePreset}',
    '"ocean_clean"'::jsonb
  )
WHERE id = 'your-tenant-id-here';  -- ⚠️ REPLACE THIS

-- Option B: Update ALL Bella Auto tenants (USE WITH CAUTION)
/*
UPDATE tenants
SET 
  brand_theme = jsonb_set(
    jsonb_set(
      jsonb_set(
        COALESCE(brand_theme, '{}'::jsonb),
        '{primaryColor}',
        '"#0891b2"'::jsonb  -- Cyan 600
      ),
      '{accentColor}',
      '"#14b8a6"'::jsonb  -- Teal 500
    ),
    '{stylePreset}',
    '"ocean_clean"'::jsonb
  )
WHERE (enabled_modules->>'bella_auto')::boolean = true;
*/

-- ============================================================================
-- Step 3: Verify changes
-- ============================================================================
SELECT 
  id,
  name,
  enabled_modules->>'bella_auto' as bella_auto_enabled,
  brand_theme->>'primaryColor' as primary_color,
  brand_theme->>'accentColor' as accent_color,
  brand_theme->>'stylePreset' as style_preset
FROM tenants
WHERE (enabled_modules->>'bella_auto')::boolean = true;

-- ============================================================================
-- Expected Results:
-- ============================================================================
-- bella_auto_enabled: true
-- primary_color: #0891b2 (Cyan 600)
-- accent_color: #14b8a6 (Teal 500)
-- style_preset: ocean_clean

-- ============================================================================
-- Color Reference:
-- ============================================================================
-- Bella Auto (Ocean Clean):
--   Primary: #0891b2 (Cyan 600) - Professional automotive blue
--   Accent:  #14b8a6 (Teal 500) - Clean, modern teal
--
-- Beauty Spa (Jade Wellness):
--   Primary: #074E44 (Dark Green)
--   Accent:  #C8A97A (Gold)
--
-- Baby Care (Bella Rose):
--   Primary: #A91555 (Pink/Rose)
--   Accent:  #F8A5C2 (Light Pink)
--
-- Real Estate (Luxury Navy):
--   Primary: #1E3A8A (Navy 900)
--   Accent:  #D97706 (Amber 600)

-- ============================================================================
-- After running this script:
-- ============================================================================
-- 1. Hard refresh browser (Ctrl+Shift+R)
-- 2. Check sidebar gradient (should be cyan/teal, not navy/pink)
-- 3. Check buttons (should be cyan, not pink)
-- 4. Check "CÀI ĐẶT" page title (should be "Thông tin Showroom", not "Thông tin Spa")
