/**
 * BELLA FACTORY — EVIDENCE COLLECTION TESTS
 * 
 * Test Suite Coverage:
 * - Adapter parsing (Architecture Guard, Build, Tests)
 * - Status preservation (PASS/FAIL/TIMEOUT/HOTSPOT/SKIP)
 * - Collector aggregation
 * - Deterministic evidence
 * - No tool execution
 * - Malformed input handling
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  parseArchitectureGuard,
  parseBuild,
  parseTests,
} from '../../.factory/evidence-adapters';
import {
  BellaEvidenceCollector,
  createEvidenceCollector,
} from '../../.factory/evidence-collector';
import type {
  ArchitectureGuardEvidence,
  BuildEvidence,
  TestEvidence,
  ProductEvidenceBundle,
} from '../../.factory/evidence-contract';

// ============================================================================
// ADAPTER TESTS — ARCHITECTURE GUARD
// ============================================================================

describe('parseArchitectureGuard', () => {
  test('should parse PASS output', () => {
    const stdout = `
✅ Architecture Guard: PASS
All frozen files verified.
No violations detected.
`;
    const evidence = parseArchitectureGuard(stdout, 0, false);

    expect(evidence.status).toBe('PASS');
    expect(evidence.violations).toEqual([]);
  });

  test('should parse FAIL output with violations', () => {
    const stdout = `
❌ Architecture Guard: FAIL

❌ FROZEN_FILE_MISSING File: src/platform/healthcare/domain/patient.ts Details: File not found in frozen baseline

❌ HASH_MISMATCH File: src/platform/education/schema.sql Details: Expected hash abc123, got def456

`;
    const evidence = parseArchitectureGuard(stdout, 1, false);

    expect(evidence.status).toBe('FAIL');
    expect(evidence.violations).toHaveLength(2);
    expect(evidence.violations[0]).toMatchObject({
      layer: 'healthcare',
      type: 'FROZEN_FILE_MISSING',
      severity: 'ERROR',
    });
    expect(evidence.violations[1]).toMatchObject({
      layer: 'education',
      type: 'HASH_MISMATCH',
      severity: 'ERROR',
    });
  });

  test('should preserve TIMEOUT status (environmental failure)', () => {
    const stdout = 'Partial output before timeout...';
    const evidence = parseArchitectureGuard(stdout, 124, true);

    expect(evidence.status).toBe('TIMEOUT');
    expect(evidence.violations).toEqual([]);
  });

  test('should handle FAIL with no parseable violations', () => {
    const stdout = 'Architecture Guard failed for unknown reason.';
    const evidence = parseArchitectureGuard(stdout, 1, false);

    expect(evidence.status).toBe('FAIL');
    expect(evidence.violations).toEqual([]);
  });

  test('should handle empty output', () => {
    const evidence = parseArchitectureGuard('', 0, false);

    expect(evidence.status).toBe('PASS');
    expect(evidence.violations).toEqual([]);
  });
});

// ============================================================================
// ADAPTER TESTS — BUILD (GATE B)
// ============================================================================

describe('parseBuild', () => {
  test('should parse all PASS scopes', () => {
    const stdout = `
✅ platform-healthcare: PASS (1.2s, 0 diagnostics)
✅ platform-host: PASS (2.5s, 0 diagnostics)
✅ platform-real-estate: PASS (0.8s, 0 diagnostics)

Summary: 3 PASS / 0 FAIL / 0 HOTSPOT
`;
    const evidence = parseBuild(stdout, 0);

    expect(evidence).toHaveLength(3);
    expect(evidence[0]).toMatchObject({
      scope: 'platform-healthcare',
      status: 'PASS',
      duration: 1200,
      diagnosticCount: 0,
    });
    expect(evidence[1]).toMatchObject({
      scope: 'platform-host',
      status: 'PASS',
      duration: 2500,
      diagnosticCount: 0,
    });
  });

  test('should parse FAIL scopes with diagnostics', () => {
    const stdout = `
❌ platform-host: FAIL (2.5s, 47 diagnostics)

platform-host diagnostics:
  src/host/domain/contract.ts:25:3 - Type 'string' is not assignable to type 'number'
  src/host/schema.ts:10:5 - Missing return type on function
  src/host/api/routes.ts:15:7 - Unused variable 'result'

✅ platform-healthcare: PASS (1.2s, 0 diagnostics)
`;
    const evidence = parseBuild(stdout, 1);

    expect(evidence).toHaveLength(2);
    
    const hostEvidence = evidence.find(e => e.scope === 'platform-host');
    expect(hostEvidence).toMatchObject({
      scope: 'platform-host',
      status: 'FAIL',
      duration: 2500,
      diagnosticCount: 47,
    });
    expect(hostEvidence?.diagnostics).toBeDefined();
    expect(hostEvidence?.diagnostics?.length).toBeGreaterThan(0);
  });

  test('should preserve HOTSPOT status (compilation timeout)', () => {
    const stdout = `
✅ platform-healthcare: PASS (1.2s, 0 diagnostics)
🔥 platform-logistics: HOTSPOT (>180s timeout)

Summary: 1 PASS / 0 FAIL / 1 HOTSPOT
`;
    const evidence = parseBuild(stdout, 2);

    expect(evidence).toHaveLength(2);
    
    const logisticsEvidence = evidence.find(e => e.scope === 'platform-logistics');
    expect(logisticsEvidence).toMatchObject({
      scope: 'platform-logistics',
      status: 'HOTSPOT',
      duration: 180000,
      diagnosticCount: 0,
    });
  });

  test('should handle mixed results', () => {
    const stdout = `
✅ platform-healthcare: PASS (1.2s, 0 diagnostics)
❌ platform-host: FAIL (2.5s, 47 diagnostics)
✅ platform-real-estate: PASS (0.8s, 0 diagnostics)
🔥 platform-logistics: HOTSPOT (>180s timeout)
`;
    const evidence = parseBuild(stdout, 2);

    expect(evidence).toHaveLength(4);
    expect(evidence.filter(e => e.status === 'PASS')).toHaveLength(2);
    expect(evidence.filter(e => e.status === 'FAIL')).toHaveLength(1);
    expect(evidence.filter(e => e.status === 'HOTSPOT')).toHaveLength(1);
  });

  test('should handle empty output', () => {
    const evidence = parseBuild('', 0);
    expect(evidence).toEqual([]);
  });
});

// ============================================================================
// ADAPTER TESTS — TESTS (JEST)
// ============================================================================

describe('parseTests', () => {
  test('should parse all PASS suites', () => {
    const jestJson = {
      testResults: [
        {
          name: 'src/__tests__/schema-generator.test.ts',
          numFailingTests: 0,
          numPassingTests: 21,
          numPendingTests: 0,
          numTotalTests: 21,
          duration: 571,
          testResults: [],
        },
        {
          name: 'src/__tests__/domain-logic.test.ts',
          numFailingTests: 0,
          numPassingTests: 15,
          numPendingTests: 0,
          numTotalTests: 15,
          duration: 423,
          testResults: [],
        },
      ],
    };

    const evidence = parseTests(jestJson);

    expect(evidence).toHaveLength(2);
    expect(evidence[0]).toMatchObject({
      suiteName: 'src/__tests__/schema-generator.test.ts',
      status: 'PASS',
      testCount: 21,
      passedCount: 21,
      failedCount: 0,
      skippedCount: 0,
      duration: 571,
    });
  });

  test('should parse FAIL suites with failure details', () => {
    const jestJson = {
      testResults: [
        {
          name: 'src/__tests__/patient-workflow.test.ts',
          numFailingTests: 2,
          numPassingTests: 8,
          numPendingTests: 0,
          numTotalTests: 10,
          duration: 652,
          testResults: [
            {
              fullName: 'Patient workflow should validate insurance',
              status: 'failed',
              failureMessages: ['Expected true, received false'],
            },
            {
              fullName: 'Patient workflow should handle edge case',
              status: 'failed',
              failureMessages: ['TypeError: Cannot read property "id" of undefined'],
            },
          ],
        },
      ],
    };

    const evidence = parseTests(jestJson);

    expect(evidence).toHaveLength(1);
    expect(evidence[0]).toMatchObject({
      status: 'FAIL',
      testCount: 10,
      passedCount: 8,
      failedCount: 2,
    });
    expect(evidence[0].failures).toHaveLength(2);
    expect(evidence[0].failures?.[0]).toMatchObject({
      testName: 'Patient workflow should validate insurance',
      errorMessage: 'Expected true, received false',
    });
  });

  test('should preserve SKIP status (all tests pending)', () => {
    const jestJson = {
      testResults: [
        {
          name: 'src/__tests__/future-feature.test.ts',
          numFailingTests: 0,
          numPassingTests: 0,
          numPendingTests: 5,
          numTotalTests: 5,
          duration: 0,
          testResults: [],
        },
      ],
    };

    const evidence = parseTests(jestJson);

    expect(evidence).toHaveLength(1);
    expect(evidence[0]).toMatchObject({
      status: 'SKIP',
      testCount: 5,
      passedCount: 0,
      failedCount: 0,
      skippedCount: 5,
    });
  });

  test('should handle mixed suite statuses', () => {
    const jestJson = {
      testResults: [
        {
          name: 'suite-pass.test.ts',
          numFailingTests: 0,
          numPassingTests: 10,
          numPendingTests: 0,
          numTotalTests: 10,
          duration: 500,
          testResults: [],
        },
        {
          name: 'suite-fail.test.ts',
          numFailingTests: 2,
          numPassingTests: 8,
          numPendingTests: 0,
          numTotalTests: 10,
          duration: 600,
          testResults: [
            { fullName: 'test1', status: 'failed', failureMessages: ['error1'] },
            { fullName: 'test2', status: 'failed', failureMessages: ['error2'] },
          ],
        },
        {
          name: 'suite-skip.test.ts',
          numFailingTests: 0,
          numPassingTests: 0,
          numPendingTests: 5,
          numTotalTests: 5,
          duration: 0,
          testResults: [],
        },
      ],
    };

    const evidence = parseTests(jestJson);

    expect(evidence).toHaveLength(3);
    expect(evidence.filter(e => e.status === 'PASS')).toHaveLength(1);
    expect(evidence.filter(e => e.status === 'FAIL')).toHaveLength(1);
    expect(evidence.filter(e => e.status === 'SKIP')).toHaveLength(1);
  });

  test('should handle empty Jest JSON', () => {
    expect(parseTests(null)).toEqual([]);
    expect(parseTests({})).toEqual([]);
    expect(parseTests({ testResults: [] })).toEqual([]);
  });

  test('should handle malformed Jest JSON gracefully', () => {
    const jestJson = {
      testResults: [
        {
          // Missing name
          numTotalTests: 5,
          testResults: [],
        },
      ],
    };

    const evidence = parseTests(jestJson);

    expect(evidence).toHaveLength(1);
    expect(evidence[0].suiteName).toBe('unknown');
  });
});

// ============================================================================
// COLLECTOR TESTS
// ============================================================================

describe('BellaEvidenceCollector', () => {
  const testOutputDir = '.factory/outputs-test';
  const testEvidenceDir = '.factory/evidence-test';

  beforeEach(() => {
    // Clean test directories
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }
    if (fs.existsSync(testEvidenceDir)) {
      fs.rmSync(testEvidenceDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testOutputDir, { recursive: true });
    fs.mkdirSync(testEvidenceDir, { recursive: true });
  });

  afterEach(() => {
    // Cleanup
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }
    if (fs.existsSync(testEvidenceDir)) {
      fs.rmSync(testEvidenceDir, { recursive: true, force: true });
    }
  });

  test('should collect evidence from existing tool outputs', async () => {
    // Setup mock outputs
    fs.writeFileSync(
      path.join(testOutputDir, 'arch-guard.txt'),
      JSON.stringify({
        stdout: '✅ Architecture Guard: PASS',
        exitCode: 0,
        timedOut: false,
      })
    );

    fs.writeFileSync(
      path.join(testOutputDir, 'build.txt'),
      JSON.stringify({
        stdout: '✅ platform-healthcare: PASS (1.2s, 0 diagnostics)',
        exitCode: 0,
      })
    );

    fs.writeFileSync(
      path.join(testOutputDir, 'tests.json'),
      JSON.stringify({
        stdout: JSON.stringify({
          testResults: [
            {
              name: 'test-suite.test.ts',
              numFailingTests: 0,
              numPassingTests: 10,
              numPendingTests: 0,
              numTotalTests: 10,
              duration: 500,
              testResults: [],
            },
          ],
        }),
        exitCode: 0,
      })
    );

    // Inject test output path
    const collector = new BellaEvidenceCollector();
    (collector as any).readToolOutput = (filePath: string) => {
      const testPath = filePath.replace('.factory/outputs', testOutputDir);
      return (BellaEvidenceCollector.prototype as any).readToolOutput.call(
        collector,
        testPath
      );
    };

    const config = {
      productId: 'healthcare',
      version: '1.0.0',
      specHash: 'abc123',
      gitCommit: 'commit-sha',
      nodeVersion: 'v18.0.0',
      toolVersions: { jest: '29.0.0' },
      outputPath: path.join(testEvidenceDir, 'bundle.json'),
    };

    const result = await collector.collect(config);

    expect(result.bundle.productId).toBe('healthcare');
    expect(result.bundle.version).toBe('1.0.0');
    expect(result.bundle.architectureGuard?.status).toBe('PASS');
    expect(result.bundle.build).toHaveLength(1);
    expect(result.bundle.tests).toHaveLength(1);
    expect(fs.existsSync(result.bundlePath)).toBe(true);
  });

  test('should not execute tools (read-only operation)', async () => {
    const collector = new BellaEvidenceCollector();
    
    // Mock tool output reader to track calls
    const readCalls: string[] = [];
    (collector as any).readToolOutput = (filePath: string) => {
      readCalls.push(filePath);
      return null;
    };

    const config = {
      productId: 'test-product',
      version: '1.0.0',
      specHash: 'hash123',
      gitCommit: 'commit-sha',
      outputPath: path.join(testEvidenceDir, 'bundle.json'),
    };

    await collector.collect(config);

    // Verify only READ operations occurred
    expect(readCalls.length).toBeGreaterThan(0);
    expect(readCalls.every(p => p.includes('.factory/outputs'))).toBe(true);
  });

  test('should produce deterministic bundle (same inputs → same structure)', async () => {
    // Create fixed test outputs
    const guardOutput = '✅ Architecture Guard: PASS';
    fs.writeFileSync(
      path.join(testOutputDir, 'arch-guard.txt'),
      JSON.stringify({ stdout: guardOutput, exitCode: 0 })
    );

    const collector1 = new BellaEvidenceCollector();
    const collector2 = new BellaEvidenceCollector();

    // Inject test path for both collectors
    const injectTestPath = (c: BellaEvidenceCollector) => {
      (c as any).readToolOutput = (filePath: string) => {
        const testPath = filePath.replace('.factory/outputs', testOutputDir);
        return (BellaEvidenceCollector.prototype as any).readToolOutput.call(
          c,
          testPath
        );
      };
    };

    injectTestPath(collector1);
    injectTestPath(collector2);

    const config = {
      productId: 'test',
      version: '1.0.0',
      specHash: 'hash',
      gitCommit: 'commit',
      outputPath: path.join(testEvidenceDir, 'bundle1.json'),
    };

    const result1 = await collector1.collect(config);
    const result2 = await collector2.collect({
      ...config,
      outputPath: path.join(testEvidenceDir, 'bundle2.json'),
    });

    // Compare deterministic fields (exclude timestamps)
    expect(result1.bundle.productId).toBe(result2.bundle.productId);
    expect(result1.bundle.version).toBe(result2.bundle.version);
    expect(result1.bundle.specHash).toBe(result2.bundle.specHash);
    expect(result1.bundle.architectureGuard).toEqual(result2.bundle.architectureGuard);
  });

  test('should handle missing tool outputs gracefully', async () => {
    // No tool outputs created
    const collector = new BellaEvidenceCollector();

    const config = {
      productId: 'test',
      version: '1.0.0',
      specHash: 'hash',
      gitCommit: 'commit',
      outputPath: path.join(testEvidenceDir, 'bundle.json'),
    };

    const result = await collector.collect(config);

    expect(result.bundle.productId).toBe('test');
    expect(result.bundle.architectureGuard).toBeUndefined();
    expect(result.bundle.build).toBeUndefined();
    expect(result.bundle.tests).toBeUndefined();
  });

  test('should load existing bundle from disk', () => {
    const bundlePath = path.join(testEvidenceDir, 'existing-bundle.json');
    const mockBundle: ProductEvidenceBundle = {
      productId: 'healthcare',
      version: '1.0.0',
      specHash: 'hash',
      collectionTimestamp: '2026-09-05T10:00:00.000Z',
      execution: {
        gitCommit: 'commit-sha',
        nodeVersion: 'v18.0.0',
      },
      architectureGuard: {
        status: 'PASS',
        violations: [],
      },
    };

    fs.writeFileSync(bundlePath, JSON.stringify(mockBundle, null, 2));

    const collector = new BellaEvidenceCollector();
    const loaded = collector.load(bundlePath);

    expect(loaded.productId).toBe('healthcare');
    expect(loaded.architectureGuard?.status).toBe('PASS');
  });

  test('should not make qualification judgments', async () => {
    const collector = new BellaEvidenceCollector();

    const config = {
      productId: 'test',
      version: '1.0.0',
      specHash: 'hash',
      gitCommit: 'commit',
      outputPath: path.join(testEvidenceDir, 'bundle.json'),
    };

    const result = await collector.collect(config);

    // Verify NO qualification fields exist
    const bundle = result.bundle as any;
    expect(bundle.qualified).toBeUndefined();
    expect(bundle.qualificationStatus).toBeUndefined();
    expect(bundle.readyForProduction).toBeUndefined();
    expect(bundle.score).toBeUndefined();
  });
});

// ============================================================================
// FACTORY FUNCTION TEST
// ============================================================================

describe('createEvidenceCollector', () => {
  test('should create collector instance', () => {
    const collector = createEvidenceCollector();
    expect(collector).toBeInstanceOf(BellaEvidenceCollector);
  });
});
