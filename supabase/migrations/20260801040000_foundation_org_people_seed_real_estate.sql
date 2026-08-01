-- ============================================================================
-- Bella EIP — Foundation Seed: Real Estate Tenant Org Structure + People Directory
-- Migration: 20260801040000
-- Layer: Foundation (Layer 1) — idempotent seed, safe to re-run
--
-- Seeds for: the MOST RECENTLY created tenant with enabled_modules containing 'real_estate'
-- (In production there will be exactly one. In demo/test there may be multiple.)
--
-- Fixed UUIDs prefixed 'f0000001-*' = Org Units (Layer 1 reserved identifiers)
-- Fixed UUIDs prefixed 'f0000002-*' = People Directory entries
--
-- Org structure seeded:
--   BRE-HQ (company)
--     REG-HCM (region) → BRANCH-HCM → TEAM-LUX, TEAM-MID
--     REG-HN  (region) → BRANCH-HN  → TEAM-HN-P
--     PRJ-VINH, PRJ-MAST (project context)
--
-- People seeded:
--   5 Employees (Manager + 4 Sales), 2 Brokers, 1 Agency
-- ============================================================================

DO $$
DECLARE
  v_tenant_id   UUID;
  v_company     UUID := 'f0000001-0000-0000-0000-000000000001'::UUID;
  v_region_hcm  UUID := 'f0000001-0000-0000-0000-000000000002'::UUID;
  v_region_hn   UUID := 'f0000001-0000-0000-0000-000000000003'::UUID;
  v_branch_hcm  UUID := 'f0000001-0000-0000-0000-000000000010'::UUID;
  v_branch_hn   UUID := 'f0000001-0000-0000-0000-000000000011'::UUID;
  v_team_lux    UUID := 'f0000001-0000-0000-0000-000000000020'::UUID;
  v_team_mid    UUID := 'f0000001-0000-0000-0000-000000000021'::UUID;
  v_team_hn_prem UUID := 'f0000001-0000-0000-0000-000000000022'::UUID;
  v_proj_vinh   UUID := 'f0000001-0000-0000-0000-000000000030'::UUID;
  v_proj_master UUID := 'f0000001-0000-0000-0000-000000000031'::UUID;
  v_mgr_hcm     UUID := 'f0000002-0000-0000-0000-000000000001'::UUID;
  v_sale_a      UUID := 'f0000002-0000-0000-0000-000000000002'::UUID;
  v_sale_b      UUID := 'f0000002-0000-0000-0000-000000000003'::UUID;
  v_sale_c      UUID := 'f0000002-0000-0000-0000-000000000004'::UUID;
  v_sale_d      UUID := 'f0000002-0000-0000-0000-000000000005'::UUID;
  v_broker_e    UUID := 'f0000002-0000-0000-0000-000000000006'::UUID;
  v_broker_f    UUID := 'f0000002-0000-0000-0000-000000000007'::UUID;
  v_agency_g    UUID := 'f0000002-0000-0000-0000-000000000008'::UUID;
BEGIN
  -- Pick the most recently created real_estate tenant
  -- enabled_modules is JSONB, use @> with jsonb literal for array-contains check
  SELECT id INTO v_tenant_id
  FROM public.tenants
  WHERE enabled_modules @> '["real_estate"]'::jsonb
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE NOTICE '[Foundation Seed] No real_estate tenant found. Skipping.';
    RETURN;
  END IF;

  RAISE NOTICE '[Foundation Seed] Seeding for tenant_id = %', v_tenant_id;

  -- 1. Org Units
  INSERT INTO public.org_units (id, tenant_id, unit_type, name, code, parent_id, is_active) VALUES
    (v_company,      v_tenant_id, 'company', 'Bella Real Estate',    'BRE-HQ',    NULL,          TRUE),
    (v_region_hcm,   v_tenant_id, 'region',  'Khu vuc HCM',          'REG-HCM',   v_company,     TRUE),
    (v_region_hn,    v_tenant_id, 'region',  'Khu vuc Ha Noi',       'REG-HN',    v_company,     TRUE),
    (v_branch_hcm,   v_tenant_id, 'branch',  'Chi nhanh HCM',        'BRANCH-HCM',v_region_hcm,  TRUE),
    (v_branch_hn,    v_tenant_id, 'branch',  'Chi nhanh Ha Noi',     'BRANCH-HN', v_region_hn,   TRUE),
    (v_team_lux,     v_tenant_id, 'team',    'Team Luxury',           'TEAM-LUX',  v_branch_hcm,  TRUE),
    (v_team_mid,     v_tenant_id, 'team',    'Team Mid-Range',        'TEAM-MID',  v_branch_hcm,  TRUE),
    (v_team_hn_prem, v_tenant_id, 'team',    'Team Premium HN',      'TEAM-HN-P', v_branch_hn,   TRUE),
    (v_proj_vinh,    v_tenant_id, 'project', 'Vinhomes Grand Park',   'PRJ-VINH',  v_company,     TRUE),
    (v_proj_master,  v_tenant_id, 'project', 'Masteri Centre Point',  'PRJ-MAST',  v_company,     TRUE)
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name, tenant_id = EXCLUDED.tenant_id, is_active = EXCLUDED.is_active, updated_at = NOW();

  -- 2. People Directory
  INSERT INTO public.people_directory (id, tenant_id, person_type, display_name, is_active) VALUES
    (v_mgr_hcm,  v_tenant_id, 'employee', 'Nguyen Van Minh (Truong phong HCM)', TRUE),
    (v_sale_a,   v_tenant_id, 'employee', 'Tran Thi Anh',                       TRUE),
    (v_sale_b,   v_tenant_id, 'employee', 'Le Quoc Binh',                        TRUE),
    (v_sale_c,   v_tenant_id, 'employee', 'Pham Thi Cam',                        TRUE),
    (v_sale_d,   v_tenant_id, 'employee', 'Do Hai Dang (HN)',                    TRUE),
    (v_broker_e, v_tenant_id, 'broker',   'Vu Thi E (Broker doc lap)',           TRUE),
    (v_broker_f, v_tenant_id, 'broker',   'Hoang Van F (Broker HCM)',            TRUE),
    (v_agency_g, v_tenant_id, 'agency',   'Cong ty G (Dai ly F1 Vinhomes)',      TRUE)
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name, tenant_id = EXCLUDED.tenant_id, is_active = EXCLUDED.is_active, updated_at = NOW();

  -- 3. People Profiles
  INSERT INTO public.people_profiles (id, tenant_id, email, phone, org_unit_ids) VALUES
    (v_mgr_hcm,  v_tenant_id, 'minh.nguyen@bellareal.vn', '0901000001', ARRAY[v_branch_hcm]),
    (v_sale_a,   v_tenant_id, 'anh.tran@bellareal.vn',    '0901000002', ARRAY[v_team_lux]),
    (v_sale_b,   v_tenant_id, 'binh.le@bellareal.vn',     '0901000003', ARRAY[v_team_lux]),
    (v_sale_c,   v_tenant_id, 'cam.pham@bellareal.vn',    '0901000004', ARRAY[v_team_mid]),
    (v_sale_d,   v_tenant_id, 'dang.do@bellareal.vn',     '0901000005', ARRAY[v_branch_hn, v_team_hn_prem]),
    (v_broker_e, v_tenant_id, 'broker.e@external.com',    '0912000001', ARRAY[v_branch_hcm]),
    (v_broker_f, v_tenant_id, 'broker.f@external.com',    '0912000002', ARRAY[v_branch_hcm]),
    (v_agency_g, v_tenant_id, 'info@ctygdl.com',          '0933000001', ARRAY[v_proj_vinh])
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email, phone = EXCLUDED.phone, org_unit_ids = EXCLUDED.org_unit_ids, updated_at = NOW();

  -- 4. Org Relationships
  INSERT INTO public.org_relationships
    (tenant_id, from_id, from_type, to_id, to_type, rel_type, role, since)
  VALUES
    -- Manager: belongs to Branch HCM + manages Branch HCM
    (v_tenant_id, v_mgr_hcm,  'person', v_branch_hcm,   'unit',   'belongs_to',     'Branch Manager',   '2026-01-01'),
    (v_tenant_id, v_mgr_hcm,  'person', v_branch_hcm,   'unit',   'manages',        'Branch Manager',   '2026-01-01'),
    -- Sale A: Team Luxury + reports to Manager + participates in Vinhomes
    (v_tenant_id, v_sale_a,   'person', v_team_lux,     'unit',   'belongs_to',     'Sales Specialist', '2026-01-01'),
    (v_tenant_id, v_sale_a,   'person', v_mgr_hcm,      'person', 'reports_to',     NULL,               '2026-01-01'),
    (v_tenant_id, v_sale_a,   'person', v_proj_vinh,    'unit',   'participates_in','Project Sale',     '2026-04-01'),
    -- Sale B: Team Luxury + reports + Vinhomes
    (v_tenant_id, v_sale_b,   'person', v_team_lux,     'unit',   'belongs_to',     'Sales Specialist', '2026-02-01'),
    (v_tenant_id, v_sale_b,   'person', v_mgr_hcm,      'person', 'reports_to',     NULL,               '2026-02-01'),
    (v_tenant_id, v_sale_b,   'person', v_proj_vinh,    'unit',   'participates_in','Project Sale',     '2026-04-01'),
    -- Sale C: Team Mid-Range + reports
    (v_tenant_id, v_sale_c,   'person', v_team_mid,     'unit',   'belongs_to',     'Sales Specialist', '2026-01-15'),
    (v_tenant_id, v_sale_c,   'person', v_mgr_hcm,      'person', 'reports_to',     NULL,               '2026-01-15'),
    -- Sale D: HN branch
    (v_tenant_id, v_sale_d,   'person', v_team_hn_prem, 'unit',   'belongs_to',     'Sales Specialist', '2026-03-01'),
    -- Brokers: HCM branch pool
    (v_tenant_id, v_broker_e, 'person', v_branch_hcm,   'unit',   'belongs_to',     'External Broker',  '2026-01-01'),
    (v_tenant_id, v_broker_f, 'person', v_branch_hcm,   'unit',   'belongs_to',     'External Broker',  '2026-02-15'),
    -- Agency G: Vinhomes project + HCM branch
    (v_tenant_id, v_agency_g, 'person', v_proj_vinh,    'unit',   'participates_in','F1 Agency',        '2026-04-01'),
    (v_tenant_id, v_agency_g, 'person', v_branch_hcm,   'unit',   'belongs_to',     'Agency Partner',   '2026-04-01')
  ON CONFLICT (tenant_id, from_id, to_id, rel_type) DO UPDATE SET
    role = EXCLUDED.role, since = EXCLUDED.since;

  RAISE NOTICE '[Foundation Seed] Done: 10 org_units, 8 people, 15 relationships for tenant %', v_tenant_id;
END $$;
