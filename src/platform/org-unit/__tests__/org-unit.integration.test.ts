/**
 * @fileoverview Org Unit Integration Tests
 * 
 * Tests engine against real org_units table + RLS policies.
 * Verifies RPCs, hierarchy queries, tenant isolation.
 */

import { createClient } from '@supabase/supabase-js';
import { createOrgUnitEngine } from '../org-unit.engine';
import type { IOrgUnitContract } from '../index';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

describe('OrgUnit Integration', () => {
  let engine: IOrgUnitContract;
  let supabase: ReturnType<typeof createClient>;
  
  const TENANT_A = crypto.randomUUID();
  const TENANT_B = crypto.randomUUID();

  beforeAll(async () => {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    engine = createOrgUnitEngine();

    // Create test tenants
    await supabase.from('tenants').insert([
      { id: TENANT_A, name: 'Tenant A Test', status: 'active' },
      { id: TENANT_B, name: 'Tenant B Test', status: 'active' }
    ]);
  });

  afterAll(async () => {
    // Cleanup
    await supabase.from('org_units').delete().in('tenant_id', [TENANT_A, TENANT_B]);
    await supabase.from('tenants').delete().in('id', [TENANT_A, TENANT_B]);
  });

  describe('R3.1 CRUD Operations', () => {
    it('should create company root unit', async () => {
      const company = await engine.createOrgUnit({
        tenantId: TENANT_A,
        unitType: 'company',
        name: 'Acme Corp',
        code: 'ACME'
      });

      expect(company.id).toBeDefined();
      expect(company.unitType).toBe('company');
      expect(company.tenantId).toBe(TENANT_A);
    });

    it('should create region under company', async () => {
      const company = await engine.createOrgUnit({
        tenantId: TENANT_A,
        unitType: 'company',
        name: 'Test Company',
        code: 'TEST-CO'
      });

      const region = await engine.createOrgUnit({
        tenantId: TENANT_A,
        unitType: 'region',
        name: 'North Region',
        code: 'NORTH',
        parentId: company.id
      });

      expect(region.parentId).toBe(company.id);
    });

    it('should create branch under region', async () => {
      const company = await engine.createOrgUnit({
        tenantId: TENANT_A,
        unitType: 'company',
        name: 'Chain Corp'
      });

      const region = await engine.createOrgUnit({
        tenantId: TENANT_A,
        unitType: 'region',
        name: 'South Region',
        parentId: company.id
      });

      const branch = await engine.createOrgUnit({
        tenantId: TENANT_A,
        unitType: 'branch',
        name: 'HCM Branch 1',
        code: 'HCM-01',
        parentId: region.id
      });

      expect(branch.parentId).toBe(region.id);
      expect(branch.unitType).toBe('branch');
    });

    it('should update org unit', async () => {
      const unit = await engine.createOrgUnit({
        tenantId: TENANT_A,
        unitType: 'branch',
        name: 'Original Name'
      });

      const updated = await engine.updateOrgUnit(unit.id, TENANT_A, {
        name: 'Updated Name'
      });

      expect(updated.name).toBe('Updated Name');
    });

    it('should archive org unit', async () => {
      const unit = await engine.createOrgUnit({
        tenantId: TENANT_A,
        unitType: 'branch',
        name: 'To Archive'
      });

      await engine.archiveOrgUnit(unit.id, TENANT_A);

      const archived = await engine.getOrgUnit(unit.id, TENANT_A);
      expect(archived?.isActive).toBe(false);
    });
  });

  describe('R3.2 Hierarchy Queries', () => {
    it('should get children of parent', async () => {
      const parent = await engine.createOrgUnit({
        tenantId: TENANT_A,
        unitType: 'region',
        name: 'Parent Region'
      });

      await engine.createOrgUnit({
        tenantId: TENANT_A,
        unitType: 'branch',
        name: 'Child Branch 1',
        parentId: parent.id
      });

      await engine.createOrgUnit({
        tenantId: TENANT_A,
        unitType: 'branch',
        name: 'Child Branch 2',
        parentId: parent.id
      });

      const children = await engine.getChildren(parent.id, TENANT_A);
      expect(children.length).toBe(2);
    });

    it('should get full hierarchy', async () => {
      const company = await engine.createOrgUnit({
        tenantId: TENANT_A,
        unitType: 'company',
        name: 'Hierarchy Test'
      });

      const region = await engine.createOrgUnit({
        tenantId: TENANT_A,
        unitType: 'region',
        name: 'Region 1',
        parentId: company.id
      });

      await engine.createOrgUnit({
        tenantId: TENANT_A,
        unitType: 'branch',
        name: 'Branch 1',
        parentId: region.id
      });

      const hierarchy = await engine.getHierarchy(company.id, TENANT_A);
      
      expect(hierarchy.length).toBe(3); // company + region + branch
      expect(hierarchy[0].depth).toBe(0); // company at root
      expect(hierarchy[1].depth).toBe(1); // region at level 1
      expect(hierarchy[2].depth).toBe(2); // branch at level 2
    });
  });

  describe('R3.3 Circular Reference Prevention', () => {
    it('should block circular reference on create', async () => {
      const unitA = await engine.createOrgUnit({
        tenantId: TENANT_A,
        unitType: 'region',
        name: 'Unit A'
      });

      const unitB = await engine.createOrgUnit({
        tenantId: TENANT_A,
        unitType: 'branch',
        name: 'Unit B',
        parentId: unitA.id
      });

      // Try to make unitA child of unitB (circular)
      await expect(
        engine.updateOrgUnit(unitA.id, TENANT_A, { parentId: unitB.id })
      ).rejects.toThrow('Circular reference');
    });

    it('should detect circular reference', async () => {
      const unitA = await engine.createOrgUnit({
        tenantId: TENANT_A,
        unitType: 'region',
        name: 'Unit A'
      });

      const unitB = await engine.createOrgUnit({
        tenantId: TENANT_A,
        unitType: 'branch',
        name: 'Unit B',
        parentId: unitA.id
      });

      const isCircular = await engine.detectCircularReference(unitA.id, unitB.id, TENANT_A);
      expect(isCircular).toBe(true);
    });
  });

  describe('R3.4 Tenant Isolation', () => {
    it('should not find unit from different tenant', async () => {
      const unitA = await engine.createOrgUnit({
        tenantId: TENANT_A,
        unitType: 'branch',
        name: 'Tenant A Unit'
      });

      const result = await engine.getOrgUnit(unitA.id, TENANT_B);
      expect(result).toBeNull();
    });

    it('should block cross-tenant parent', async () => {
      const unitA = await engine.createOrgUnit({
        tenantId: TENANT_A,
        unitType: 'region',
        name: 'Tenant A Region'
      });

      await expect(
        engine.createOrgUnit({
          tenantId: TENANT_B,
          unitType: 'branch',
          name: 'Tenant B Branch',
          parentId: unitA.id
        })
      ).rejects.toThrow('Tenant mismatch');
    });
  });

  describe('R3.5 Code Uniqueness', () => {
    it('should enforce unique code per tenant', async () => {
      await engine.createOrgUnit({
        tenantId: TENANT_A,
        unitType: 'branch',
        name: 'Branch 1',
        code: 'UNIQUE-001'
      });

      await expect(
        engine.createOrgUnit({
          tenantId: TENANT_A,
          unitType: 'branch',
          name: 'Branch 2',
          code: 'UNIQUE-001'
        })
      ).rejects.toThrow('Code already exists');
    });

    it('should allow same code in different tenants', async () => {
      await engine.createOrgUnit({
        tenantId: TENANT_A,
        unitType: 'branch',
        name: 'Branch A',
        code: 'SHARED-001'
      });

      const unitB = await engine.createOrgUnit({
        tenantId: TENANT_B,
        unitType: 'branch',
        name: 'Branch B',
        code: 'SHARED-001'
      });

      expect(unitB.code).toBe('SHARED-001');
    });
  });
});
