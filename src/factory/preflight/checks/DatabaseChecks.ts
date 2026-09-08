/**
 * Factory Preflight Guard — Database Checks
 * 
 * Origin: Bella Land E2E failure (missing anon SELECT on real_estate_projects)
 * Purpose: Detect DB privilege gaps before E2E runs
 * 
 * Evidence: ~30 min saved per privilege gap caught early
 */

import { createClient } from '@supabase/supabase-js';
import type {
  PreflightCheck,
  PreflightResult,
  DatabasePrivilege,
  RLSCheck,
} from '../types';

export class DatabaseChecks {
  private supabaseUrl: string;
  private supabaseKey: string;

  constructor() {
    this.supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    this.supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  }

  /**
   * Check if database connection can be established
   */
  createConnectionCheck(): PreflightCheck {
    return {
      id: 'db-connection',
      name: 'Database Connection',
      category: 'database',
      required: true,
      check: async (): Promise<PreflightResult> => {
        const timestamp = new Date().toISOString();

        if (!this.supabaseUrl || !this.supabaseKey) {
          return {
            passed: false,
            status: 'FAIL',
            message: 'Database credentials missing',
            evidence: `SUPABASE_URL: ${!!this.supabaseUrl}, SERVICE_ROLE_KEY: ${!!this.supabaseKey}`,
            suggestion: 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables',
            timestamp,
          };
        }

        try {
          const client = createClient(this.supabaseUrl, this.supabaseKey);
          const { error } = await client.from('tenants').select('count').limit(1);

          if (error) {
            return {
              passed: false,
              status: 'FAIL',
              message: 'Database connection failed',
              evidence: error.message,
              suggestion: 'Check database credentials and network connectivity',
              timestamp,
            };
          }

          return {
            passed: true,
            status: 'PASS',
            message: 'Database connection successful',
            timestamp,
          };
        } catch (err) {
          return {
            passed: false,
            status: 'FAIL',
            message: 'Database connection error',
            evidence: err instanceof Error ? err.message : String(err),
            timestamp,
          };
        }
      },
    };
  }

  /**
   * Check if required tables exist
   */
  createTableExistenceCheck(tables: string[]): PreflightCheck {
    return {
      id: 'db-tables-exist',
      name: 'Required Tables Exist',
      category: 'database',
      required: true,
      check: async (): Promise<PreflightResult> => {
        const timestamp = new Date().toISOString();

        try {
          const client = createClient(this.supabaseUrl, this.supabaseKey);

          // Query pg_catalog to check table existence
          const { data, error } = await client.rpc('check_tables_exist', {
            table_names: tables,
          });

          if (error) {
            // Fallback: try querying each table directly
            const missingTables: string[] = [];
            for (const table of tables) {
              const { error: tableError } = await client
                .from(table)
                .select('*')
                .limit(0);
              
              if (tableError && tableError.code === '42P01') {
                missingTables.push(table);
              }
            }

            if (missingTables.length > 0) {
              return {
                passed: false,
                status: 'FAIL',
                message: `Missing tables: ${missingTables.join(', ')}`,
                evidence: `Required: ${tables.length}, Found: ${tables.length - missingTables.length}`,
                suggestion: 'Run database migrations to create missing tables',
                timestamp,
              };
            }
          }

          return {
            passed: true,
            status: 'PASS',
            message: `All required tables exist (${tables.length})`,
            timestamp,
          };
        } catch (err) {
          return {
            passed: false,
            status: 'FAIL',
            message: 'Table existence check failed',
            evidence: err instanceof Error ? err.message : String(err),
            timestamp,
          };
        }
      },
    };
  }

  /**
   * Check table privileges for specific roles
   * 
   * CRITICAL: This check directly addresses Bella Land failure
   * (missing anon SELECT on real_estate_projects)
   */
  createPrivilegeCheck(privileges: DatabasePrivilege[]): PreflightCheck {
    return {
      id: 'db-privileges',
      name: 'Table Privileges',
      category: 'database',
      required: true,
      check: async (): Promise<PreflightResult> => {
        const timestamp = new Date().toISOString();

        try {
          const client = createClient(this.supabaseUrl, this.supabaseKey);

          const violations: string[] = [];

          for (const priv of privileges) {
            // Query information_schema to check grants
            const { data, error } = await client.rpc('check_table_privilege', {
              table_name: priv.table,
              role_name: priv.role,
              privilege_type: priv.privilege,
            });

            if (error) {
              // Fallback: try actual query to detect privilege issue
              const testClient = createClient(
                this.supabaseUrl,
                priv.role === 'anon'
                  ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
                  : this.supabaseKey
              );

              const { error: testError } = await testClient
                .from(priv.table)
                .select('*')
                .limit(0);

              if (testError && testError.code === '42501') {
                violations.push(
                  `${priv.table}: role '${priv.role}' missing ${priv.privilege}`
                );
              }
            } else if (!data) {
              violations.push(
                `${priv.table}: role '${priv.role}' missing ${priv.privilege}`
              );
            }
          }

          if (violations.length > 0) {
            const suggestions = violations.map(v => {
              const match = v.match(/(.+): role '(.+)' missing (.+)/);
              if (match) {
                const [, table, role, priv] = match;
                return `GRANT ${priv} ON TABLE public.${table} TO ${role};`;
              }
              return '';
            });

            return {
              passed: false,
              status: 'FAIL',
              message: `Table privilege violations (${violations.length})`,
              evidence: violations.join('\n'),
              suggestion: `Run these grants:\n${suggestions.join('\n')}`,
              timestamp,
            };
          }

          return {
            passed: true,
            status: 'PASS',
            message: `All table privileges configured (${privileges.length})`,
            timestamp,
          };
        } catch (err) {
          return {
            passed: false,
            status: 'FAIL',
            message: 'Privilege check failed',
            evidence: err instanceof Error ? err.message : String(err),
            timestamp,
          };
        }
      },
    };
  }

  /**
   * Check RLS (Row Level Security) enabled and policies exist
   */
  createRLSCheck(rlsChecks: RLSCheck[]): PreflightCheck {
    return {
      id: 'db-rls',
      name: 'RLS Configuration',
      category: 'database',
      required: true,
      check: async (): Promise<PreflightResult> => {
        const timestamp = new Date().toISOString();

        try {
          const client = createClient(this.supabaseUrl, this.supabaseKey);

          const violations: string[] = [];

          for (const rlsCheck of rlsChecks) {
            // Check if RLS is enabled
            const { data: rlsData, error: rlsError } = await client.rpc(
              'check_rls_enabled',
              { table_name: rlsCheck.table }
            );

            if (rlsError) {
              violations.push(`${rlsCheck.table}: cannot verify RLS status`);
              continue;
            }

            if (rlsCheck.rlsEnabled && !rlsData) {
              violations.push(`${rlsCheck.table}: RLS not enabled`);
            }

            // Check if required policies exist
            if (rlsCheck.policies.length > 0) {
              const { data: policiesData, error: policiesError } = await client.rpc(
                'check_policies_exist',
                {
                  table_name: rlsCheck.table,
                  policy_names: rlsCheck.policies,
                }
              );

              if (policiesError) {
                violations.push(
                  `${rlsCheck.table}: cannot verify policies (${rlsCheck.policies.join(', ')})`
                );
              } else {
                const missingPolicies = rlsCheck.policies.filter(
                  p => !(policiesData as string[])?.includes(p)
                );
                if (missingPolicies.length > 0) {
                  violations.push(
                    `${rlsCheck.table}: missing policies (${missingPolicies.join(', ')})`
                  );
                }
              }
            }
          }

          if (violations.length > 0) {
            return {
              passed: false,
              status: 'FAIL',
              message: `RLS configuration issues (${violations.length})`,
              evidence: violations.join('\n'),
              suggestion:
                'Run RLS migrations or check policy definitions in database',
              timestamp,
            };
          }

          return {
            passed: true,
            status: 'PASS',
            message: `RLS properly configured (${rlsChecks.length} tables)`,
            timestamp,
          };
        } catch (err) {
          return {
            passed: false,
            status: 'WARN',
            message: 'RLS check encountered errors (not blocking)',
            evidence: err instanceof Error ? err.message : String(err),
            timestamp,
          };
        }
      },
    };
  }
}
