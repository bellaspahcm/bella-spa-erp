/**
 * G6: RLS/Tenant Safety Validation
 * 
 * Validates tenant isolation integrity (Gate 0 / P0):
 * - ALL tenant-scoped tables MUST have RLS enabled
 * - Tenant isolation policies MUST exist
 * - No cross-tenant data access
 * - Tenant ID columns properly configured
 * 
 * This is P0 - FAIL IMMEDIATELY if violated.
 */

import type { Migration, PreflightResult, ValidationFailure } from '../types';
import type { Pool } from 'pg';

export async function validateTenantSafety(
  migration: Migration,
  db: Pool
): Promise<PreflightResult> {
  const failures: ValidationFailure[] = [];
  
  try {
    // Check 1: Detect new tables being created
    const createTablePattern = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_]+)\.?([a-z_]+)?\s*\(/gi;
    let match;
    const newTables: Array<{ schema: string; name: string }> = [];
    
    while ((match = createTablePattern.exec(migration.sql)) !== null) {
      if (match[2]) {
        newTables.push({ schema: match[1], name: match[2] });
      } else {
        newTables.push({ schema: 'public', name: match[1] });
      }
    }
    
    // Check 2: For each new table, verify RLS will be enabled
    for (const table of newTables) {
      const rlsEnablePattern = new RegExp(
        `ALTER\\s+TABLE\\s+${table.schema}\\.${table.name}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`,
        'gi'
      );
      
      if (!rlsEnablePattern.test(migration.sql)) {
        // Check if table is system/internal (may not need RLS)
        const systemTables = ['schema_migrations', 'audit_log', 'system_config'];
        const isSystemTable = systemTables.includes(table.name) || 
                             table.name.startsWith('pg_') ||
                             table.name.startsWith('_');
        
        if (!isSystemTable) {
          failures.push({
            gate: 'G6_TENANT_SAFETY',
            reason: `Table '${table.schema}.${table.name}' created without RLS enabled.\n` +
                    `  Gate 0 (P0): ALL tenant-scoped tables MUST have RLS.`,
            severity: 'ERROR',
            recommendation: `Add: ALTER TABLE ${table.schema}.${table.name} ENABLE ROW LEVEL SECURITY;`
          });
        }
      }
    }
    
    // Check 3: Verify tenant_id column exists for tenant-scoped tables
    for (const table of newTables) {
      const tenantIdPattern = new RegExp(
        `${table.name}\\s*\\([^)]*tenant_id\\s+UUID`,
        'gi'
      );
      
      if (!tenantIdPattern.test(migration.sql)) {
        // Check if table is tenant-scoped
        const globalTables = ['system_config', 'migrations', 'audit_log'];
        const isGlobalTable = globalTables.includes(table.name);
        
        if (!isGlobalTable) {
          failures.push({
            gate: 'G6_TENANT_SAFETY',
            reason: `Table '${table.schema}.${table.name}' missing tenant_id column.\n` +
                    `  Tenant-scoped tables MUST include tenant_id UUID column.`,
            severity: 'ERROR',
            recommendation: `Add column: tenant_id UUID NOT NULL REFERENCES auth.tenants(id)`
          });
        }
      }
    }
    
    // Check 4: Detect RLS DISABLE (absolute violation)
    const rlsDisablePattern = /DISABLE\s+ROW\s+LEVEL\s+SECURITY/gi;
    if (rlsDisablePattern.test(migration.sql)) {
      failures.push({
        gate: 'G6_TENANT_SAFETY',
        reason: 'CRITICAL: Attempt to DISABLE ROW LEVEL SECURITY detected.\n' +
                '  This violates Gate 0 (P0) - Tenant Isolation.\n' +
                '  This is an absolute blocker.',
        severity: 'ERROR',
        recommendation: 'STOP. Remove DISABLE RLS statement. Tenant isolation MUST be maintained at all times.'
      });
    }
    
    // Check 5: Verify RLS policies are created
    for (const table of newTables) {
      const policyPattern = new RegExp(
        `CREATE\\s+POLICY\\s+\\w+\\s+ON\\s+${table.schema}\\.${table.name}`,
        'gi'
      );
      
      if (!policyPattern.test(migration.sql)) {
        failures.push({
          gate: 'G6_TENANT_SAFETY',
          reason: `Table '${table.schema}.${table.name}' has RLS enabled but no policies defined.\n` +
                  `  Empty RLS = no access for anyone.`,
          severity: 'ERROR',
          recommendation: 'Create RLS policies for SELECT, INSERT, UPDATE, DELETE operations'
        });
      }
    }
    
    // Check 6: Validate tenant isolation in policies
    const policyDefinitions = migration.sql.match(/CREATE\s+POLICY\s+[\s\S]*?;/gi) || [];
    
    for (const policy of policyDefinitions) {
      // Check if policy uses tenant_id in USING clause
      if (!policy.toLowerCase().includes('tenant_id')) {
        failures.push({
          gate: 'G6_TENANT_SAFETY',
          reason: 'RLS policy detected without tenant_id check.\n' +
                  '  All tenant-scoped policies MUST filter by tenant_id.',
          severity: 'ERROR',
          recommendation: 'Add tenant_id check: USING (tenant_id = auth.current_tenant_id())'
        });
      }
    }
    
    // Check 7: Verify existing tables maintain RLS
    const alterTablePattern = /ALTER\s+TABLE\s+([a-z_]+)\.?([a-z_]+)?/gi;
    const alteredTables: Array<{ schema: string; name: string }> = [];
    
    while ((match = alterTablePattern.exec(migration.sql)) !== null) {
      if (match[2]) {
        alteredTables.push({ schema: match[1], name: match[2] });
      } else {
        alteredTables.push({ schema: 'public', name: match[1] });
      }
    }
    
    for (const table of alteredTables) {
      // Check if table currently has RLS
      const rlsStatus = await db.query(`
        SELECT relrowsecurity
        FROM pg_class
        JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
        WHERE pg_namespace.nspname = $1 AND pg_class.relname = $2
      `, [table.schema, table.name]);
      
      if (rlsStatus.rows.length > 0 && rlsStatus.rows[0].relrowsecurity) {
        // Table has RLS - ensure migration doesn't disable it
        if (rlsDisablePattern.test(migration.sql)) {
          failures.push({
            gate: 'G6_TENANT_SAFETY',
            reason: `Attempt to disable RLS on existing table '${table.schema}.${table.name}'.\n` +
                    `  Gate 0 violation: Cannot disable tenant isolation.`,
            severity: 'ERROR',
            recommendation: 'STOP. Tenant isolation cannot be disabled.'
          });
        }
      }
    }
    
  } catch (error) {
    failures.push({
      gate: 'G6_TENANT_SAFETY',
      reason: `Failed to validate tenant safety: ${error instanceof Error ? error.message : String(error)}`,
      severity: 'ERROR',
      recommendation: 'Cannot proceed without tenant safety validation'
    });
  }
  
  return {
    pass: failures.length === 0,
    gate: 'G6_TENANT_SAFETY',
    failures,
    timestamp: new Date()
  };
}
