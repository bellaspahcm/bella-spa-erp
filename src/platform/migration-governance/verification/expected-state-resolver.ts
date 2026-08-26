/**
 * Phase 4B.3 — Expected State Resolver
 * 
 * Contract: P0_3_PHASE4B_3_CONTRACT.md v1.0.0 (commit 37ae4544)
 * 
 * CRITICAL: Expected state MUST NOT be inferred from actual database state.
 * Expected state = Contract Invariants + Migration Declaration.
 * 
 * "4B.3 MUST never infer correctness from actual database state alone.
 *  Expected state MUST originate from a declared contract invariant or
 *  explicit migration declaration."
 */

import { ExpectedState, MigrationDeclaration, SECURITY_CRITICAL_TABLES, RLS_REQUIRED_POLICIES } from './types';
import * as fs from 'fs/promises';
import * as yaml from 'yaml';

/**
 * Resolve Expected State from Contract + Declaration
 * 
 * Step 1: Load Contract Invariants (security)
 * Step 2: Parse Migration Declaration (if exists)
 * Step 3: Merge (Contract takes precedence)
 */
export class ExpectedStateResolver {
  /**
   * Resolve expected state for verification
   * 
   * @param migrationFile - Path to migration SQL file
   * @returns Expected state (Contract invariants + Migration declaration)
   */
  async resolve(migrationFile: string): Promise<ExpectedState> {
    // Step 1: Contract Invariants (ALWAYS present)
    const securityInvariants = this.getContractInvariants();

    // Step 2: Migration Declaration (OPTIONAL in Phase 1)
    const migrationDeclaration = await this.parseMigrationDeclaration(migrationFile);

    // Step 3: Merge
    const expectedState: ExpectedState = {
      securityInvariants,
      migrationExpectations: migrationDeclaration
        ? this.convertDeclarationToExpectations(migrationDeclaration)
        : {},
    };

    return expectedState;
  }

  /**
   * Get Contract Invariants (from Contract v1.0.0)
   * 
   * Phase 1: Security-critical RLS + Tenant isolation
   */
  private getContractInvariants(): ExpectedState['securityInvariants'] {
    return {
      tenantIsolation: {
        tables: [...SECURITY_CRITICAL_TABLES], // Security-critical tables
        rlsEnabled: true, // MUST be true
        policiesRequired: [...RLS_REQUIRED_POLICIES], // All 4 policies required
      },
      coreConstraints: {
        primaryKeysRequired: true,
        foreignKeysValidated: true,
        notNullEnforced: true,
      },
    };
  }

  /**
   * Parse Migration Declaration (YAML front-matter or .declaration.json)
   * 
   * Phase 1: Support YAML front-matter in SQL file
   * Format:
   *   /*
   *   verification:
   *     tables:
   *       hc_appointments:
   *         columns:
   *           appointment_id: uuid
   *         rls: required
   *   *\/
   * 
   * @param migrationFile - Path to migration SQL file
   * @returns Migration declaration or null
   */
  private async parseMigrationDeclaration(migrationFile: string): Promise<MigrationDeclaration | null> {
    try {
      // Check if .declaration.json exists
      const declarationFile = migrationFile.replace('.sql', '.declaration.json');
      try {
        const content = await fs.readFile(declarationFile, 'utf-8');
        return JSON.parse(content) as MigrationDeclaration;
      } catch {
        // .declaration.json not found, try YAML front-matter
      }

      // Try YAML front-matter in SQL file
      const sqlContent = await fs.readFile(migrationFile, 'utf-8');
      const frontMatterMatch = sqlContent.match(/\/\*\s*\n(verification:[\s\S]*?)\n\s*\*\//);

      if (frontMatterMatch) {
        const yamlContent = frontMatterMatch[1];
        const parsed = yaml.parse(yamlContent);
        return parsed.verification as MigrationDeclaration;
      }

      // No declaration found
      return null;
    } catch (error) {
      // Cannot parse declaration → return null (fallback to Contract invariants only)
      console.warn(`Cannot parse migration declaration: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Convert Migration Declaration to Expectations
   */
  private convertDeclarationToExpectations(
    declaration: MigrationDeclaration
  ): ExpectedState['migrationExpectations'] {
    if (!declaration.tables) {
      return {};
    }

    const tables: ExpectedState['migrationExpectations']['tables'] = {};

    for (const [tableName, tableDecl] of Object.entries(declaration.tables)) {
      tables[tableName] = {
        columns: tableDecl.columns,
        primary_key: tableDecl.primary_key,
        foreign_keys: tableDecl.foreign_keys,
        rls_required: tableDecl.rls === 'required',
      };
    }

    return { tables };
  }
}
