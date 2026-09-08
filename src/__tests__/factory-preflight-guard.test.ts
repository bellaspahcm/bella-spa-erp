/**
 * Factory Preflight Guard — Unit Tests
 * 
 * Tests P0 capability: Environment validation before E2E execution
 */

import { PreflightGuard } from '@/factory/preflight/PreflightGuard';
import { DatabaseChecks } from '@/factory/preflight/checks/DatabaseChecks';
import { EnvironmentChecks } from '@/factory/preflight/checks/EnvironmentChecks';
import type { PreflightCheck, PreflightResult } from '@/factory/preflight/types';

describe('Factory Preflight Guard', () => {
  describe('PreflightGuard Orchestrator', () => {
    let guard: PreflightGuard;

    beforeEach(() => {
      guard = new PreflightGuard();
    });

    it('should register and run a single check', async () => {
      const mockCheck: PreflightCheck = {
        id: 'test-check',
        name: 'Test Check',
        category: 'environment',
        required: true,
        check: async (): Promise<PreflightResult> => ({
          passed: true,
          status: 'PASS',
          message: 'Test passed',
          timestamp: new Date().toISOString(),
        }),
      };

      guard.registerCheck(mockCheck);

      const result = await guard.run({
        product: 'test-product',
        checks: ['environment'],
        verbose: false,
      });

      expect(result.passed).toBe(true);
      expect(result.totalChecks).toBe(1);
      expect(result.passed_count).toBe(1);
      expect(result.failed_count).toBe(0);
      expect(result.blockers).toHaveLength(0);
    });

    it('should detect failures in required checks', async () => {
      const failingCheck: PreflightCheck = {
        id: 'failing-check',
        name: 'Failing Check',
        category: 'database',
        required: true,
        check: async (): Promise<PreflightResult> => ({
          passed: false,
          status: 'FAIL',
          message: 'Check failed',
          suggestion: 'Fix the issue',
          timestamp: new Date().toISOString(),
        }),
      };

      guard.registerCheck(failingCheck);

      const result = await guard.run({
        product: 'test-product',
        checks: ['database'],
        verbose: false,
      });

      expect(result.passed).toBe(false);
      expect(result.failed_count).toBe(1);
      expect(result.blockers).toHaveLength(1);
      expect(result.blockers[0]).toBe('Check failed');
    });

    it('should handle warnings without blocking', async () => {
      const warningCheck: PreflightCheck = {
        id: 'warning-check',
        name: 'Warning Check',
        category: 'environment',
        required: false,
        check: async (): Promise<PreflightResult> => ({
          passed: false,
          status: 'WARN',
          message: 'Non-critical issue',
          timestamp: new Date().toISOString(),
        }),
      };

      guard.registerCheck(warningCheck);

      const result = await guard.run({
        product: 'test-product',
        checks: ['environment'],
        verbose: false,
      });

      expect(result.passed).toBe(true); // Warnings don't block
      expect(result.warned_count).toBe(1);
      expect(result.warnings).toHaveLength(1);
      expect(result.blockers).toHaveLength(0);
    });

    it('should filter checks by category', async () => {
      const dbCheck: PreflightCheck = {
        id: 'db-check',
        name: 'DB Check',
        category: 'database',
        required: true,
        check: async () => ({
          passed: true,
          status: 'PASS',
          message: 'DB OK',
          timestamp: new Date().toISOString(),
        }),
      };

      const envCheck: PreflightCheck = {
        id: 'env-check',
        name: 'Env Check',
        category: 'environment',
        required: true,
        check: async () => ({
          passed: true,
          status: 'PASS',
          message: 'Env OK',
          timestamp: new Date().toISOString(),
        }),
      };

      guard.registerChecks([dbCheck, envCheck]);

      const result = await guard.run({
        product: 'test-product',
        checks: ['database'], // Only request database checks
        verbose: false,
      });

      expect(result.totalChecks).toBe(1);
      expect(result.checks[0].category).toBe('database');
    });

    it('should skip optional checks when requested', async () => {
      const requiredCheck: PreflightCheck = {
        id: 'required',
        name: 'Required',
        category: 'database',
        required: true,
        check: async () => ({
          passed: true,
          status: 'PASS',
          message: 'OK',
          timestamp: new Date().toISOString(),
        }),
      };

      const optionalCheck: PreflightCheck = {
        id: 'optional',
        name: 'Optional',
        category: 'database',
        required: false,
        check: async () => ({
          passed: true,
          status: 'PASS',
          message: 'OK',
          timestamp: new Date().toISOString(),
        }),
      };

      guard.registerChecks([requiredCheck, optionalCheck]);

      const result = await guard.run({
        product: 'test-product',
        checks: ['database'],
        skipOptional: true,
        verbose: false,
      });

      expect(result.totalChecks).toBe(1);
      expect(result.checks[0].id).toBe('required');
    });

    it('should handle check exceptions gracefully', async () => {
      const throwingCheck: PreflightCheck = {
        id: 'throwing',
        name: 'Throwing Check',
        category: 'environment',
        required: true,
        check: async () => {
          throw new Error('Unexpected error');
        },
      };

      guard.registerCheck(throwingCheck);

      const result = await guard.run({
        product: 'test-product',
        checks: ['environment'],
        verbose: false,
      });

      expect(result.passed).toBe(false);
      expect(result.failed_count).toBe(1);
      expect(result.checks[0].message).toContain('threw exception');
    });

    it('should measure execution time', async () => {
      const slowCheck: PreflightCheck = {
        id: 'slow',
        name: 'Slow Check',
        category: 'database',
        required: true,
        check: async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return {
            passed: true,
            status: 'PASS',
            message: 'Slow but steady',
            timestamp: new Date().toISOString(),
          };
        },
      };

      guard.registerCheck(slowCheck);

      const result = await guard.run({
        product: 'test-product',
        checks: ['database'],
        verbose: false,
      });

      expect(result.timeElapsed).toBeGreaterThanOrEqual(100);
    });
  });

  describe('EnvironmentChecks', () => {
    let envChecks: EnvironmentChecks;

    beforeEach(() => {
      envChecks = new EnvironmentChecks();
    });

    it('should pass when all required env vars are present', async () => {
      // Set test env vars
      process.env.TEST_VAR_1 = 'value1';
      process.env.TEST_VAR_2 = 'value2';

      const check = envChecks.createEnvVarsCheck([
        { name: 'TEST_VAR_1', required: true },
        { name: 'TEST_VAR_2', required: true },
      ]);

      const result = await check.check();

      expect(result.passed).toBe(true);
      expect(result.status).toBe('PASS');

      // Cleanup
      delete process.env.TEST_VAR_1;
      delete process.env.TEST_VAR_2;
    });

    it('should fail when required env vars are missing', async () => {
      const check = envChecks.createEnvVarsCheck([
        { name: 'MISSING_VAR_1', required: true },
        { name: 'MISSING_VAR_2', required: true },
      ]);

      const result = await check.check();

      expect(result.passed).toBe(false);
      expect(result.status).toBe('FAIL');
      expect(result.evidence).toContain('MISSING_VAR_1');
      expect(result.evidence).toContain('MISSING_VAR_2');
      expect(result.suggestion).toBeTruthy();
    });

    it('should validate Node.js version', async () => {
      const check = envChecks.createNodeVersionCheck('0.0.1'); // Very low requirement

      const result = await check.check();

      expect(result.passed).toBe(true);
      expect(result.status).toBe('PASS');
      expect(result.message).toContain('compatible');
    });

    it('should warn on incompatible Node.js version', async () => {
      const check = envChecks.createNodeVersionCheck('999.0.0'); // Unrealistic requirement

      const result = await check.check();

      expect(result.passed).toBe(false);
      expect(result.status).toBe('WARN');
      expect(result.message).toContain('below recommended');
    });
  });

  describe('Integration: Bella Land Scenario', () => {
    it('should detect missing DB privilege (Bella Land failure case)', async () => {
      const guard = new PreflightGuard();

      // Simulate the Bella Land failure: missing anon SELECT on real_estate_projects
      const mockPrivilegeCheck: PreflightCheck = {
        id: 'db-privileges',
        name: 'Table Privileges',
        category: 'database',
        required: true,
        check: async (): Promise<PreflightResult> => {
          // Simulate detection of missing privilege
          return {
            passed: false,
            status: 'FAIL',
            message: 'Table privilege violations (1)',
            evidence: "real_estate_projects: role 'anon' missing SELECT",
            suggestion:
              'GRANT SELECT ON TABLE public.real_estate_projects TO anon;',
            timestamp: new Date().toISOString(),
          };
        },
      };

      guard.registerCheck(mockPrivilegeCheck);

      const result = await guard.run({
        product: 'bella-land',
        checks: ['database'],
        verbose: false,
      });

      // Preflight should FAIL (catch the issue before E2E)
      expect(result.passed).toBe(false);
      expect(result.blockers).toHaveLength(1);
      expect(result.blockers[0]).toContain('privilege violations');

      // Suggestion should provide fix
      const checkResult = result.checks.find(c => c.id === 'db-privileges');
      expect(checkResult?.suggestion).toContain('GRANT SELECT');
      expect(checkResult?.suggestion).toContain('real_estate_projects');
    });

    it('should pass when all Bella Land requirements are met', async () => {
      const guard = new PreflightGuard();

      const allPassChecks: PreflightCheck[] = [
        {
          id: 'db-connection',
          name: 'Database Connection',
          category: 'database',
          required: true,
          check: async () => ({
            passed: true,
            status: 'PASS',
            message: 'Connection successful',
            timestamp: new Date().toISOString(),
          }),
        },
        {
          id: 'db-privileges',
          name: 'Table Privileges',
          category: 'database',
          required: true,
          check: async () => ({
            passed: true,
            status: 'PASS',
            message: 'All privileges configured',
            timestamp: new Date().toISOString(),
          }),
        },
        {
          id: 'env-vars',
          name: 'Environment Variables',
          category: 'environment',
          required: true,
          check: async () => ({
            passed: true,
            status: 'PASS',
            message: 'All vars present',
            timestamp: new Date().toISOString(),
          }),
        },
      ];

      guard.registerChecks(allPassChecks);

      const result = await guard.run({
        product: 'bella-land',
        checks: ['database', 'environment'],
        verbose: false,
      });

      expect(result.passed).toBe(true);
      expect(result.passed_count).toBe(3);
      expect(result.blockers).toHaveLength(0);
    });
  });

  describe('Performance', () => {
    it('should run multiple checks in parallel (fast)', async () => {
      const guard = new PreflightGuard();

      // Create 5 checks that each take 100ms
      const checks: PreflightCheck[] = Array.from({ length: 5 }, (_, i) => ({
        id: `check-${i}`,
        name: `Check ${i}`,
        category: 'database',
        required: true,
        check: async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return {
            passed: true,
            status: 'PASS',
            message: 'OK',
            timestamp: new Date().toISOString(),
          };
        },
      }));

      guard.registerChecks(checks);

      const startTime = Date.now();
      const result = await guard.run({
        product: 'performance-test',
        checks: ['database'],
        verbose: false,
      });
      const elapsed = Date.now() - startTime;

      // If run in parallel, should take ~100ms
      // If run sequentially, would take ~500ms
      expect(elapsed).toBeLessThan(250); // Allow some overhead
      expect(result.passed_count).toBe(5);
    });
  });
});
