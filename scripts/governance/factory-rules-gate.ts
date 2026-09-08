#!/usr/bin/env node
/**
 * Factory Rules Gate Orchestrator
 * 
 * Executes all automated Factory Rules across G2/G3/G4 gates
 * 
 * Usage:
 *   npm run governance:factory-rules [--config=tsconfig.json] [--scope=file.ts]
 * 
 * Exit codes:
 *   0 = All rules PASS
 *   2 = One or more rules BLOCK
 *   1 = Execution error
 */

import { execSync, exec, spawn } from 'child_process';
import { platform } from 'os';
import * as path from 'path';

interface RuleExecution {
  rule: string;
  gate: string;
  passed: boolean;
  output: string;
  exitCode: number;
}

interface GateResult {
  gate: string;
  rulesExecuted: number;
  rulesPassed: number;
  rulesFailed: number;
  executions: RuleExecution[];
}

const RULES = [
  {
    name: 'Rule 2: Schema ↔ Type Drift Guard',
    gate: 'G2',
    script: 'scripts/governance/rules/g2-rule2-schema-type-drift.ts',
  },
  {
    name: 'Rule 4: Explicit Mapper Contract Guard',
    gate: 'G2',
    script: 'scripts/governance/rules/g2-rule4-mapper-contract.ts',
  },
  {
    name: 'Rule 10: Repeated Root-Cause Occurrence Guard',
    gate: 'G3',
    script: 'scripts/governance/rules/g3-rule10-repeated-root-cause.ts',
  },
  {
    name: 'Rule 7: Diagnostic Inventory Reconciliation Guard',
    gate: 'G4',
    script: 'scripts/governance/rules/g4-rule7-diagnostic-inventory.ts',
  },
];

/**
 * Execute a single rule script (async for parallel execution)
 * WITH FULL LIFECYCLE INSTRUMENTATION
 * PRODUCTION-GRADE: Direct tsx executable (no shell, no npx)
 */
async function executeRuleAsync(
  rule: { name: string; gate: string; script: string },
  configPath?: string,
  scope?: string
): Promise<RuleExecution> {
  const args: string[] = [rule.script];
  
  if (configPath) {
    args.push(configPath);
  }

  // Canonical scope wiring: Rule 7 requires --scope
  // Pass as separate argv element (no shell parsing)
  if (scope && rule.script.includes('g4-rule7')) {
    args.push('--scope', scope);
  }

  const startTime = Date.now();
  console.log(`[${rule.name}] Starting at ${new Date(startTime).toISOString()}`);

  // Production-grade: Direct local tsx executable
  // Windows: tsx.cmd requires shell=true, quote executable path for spaces
  const tsxBin = platform() === 'win32' ? 'tsx.cmd' : 'tsx';
  const tsxPathRaw = path.resolve(__dirname, '../../node_modules/.bin', tsxBin);
  const tsxPath = platform() === 'win32' ? `"${tsxPathRaw}"` : tsxPathRaw;
  
  return new Promise((resolve) => {
    const child = spawn(tsxPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: platform() === 'win32', // Windows .cmd files require shell
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    // Lifecycle event: spawn
    child.on('spawn', () => {
      const elapsed = Date.now() - startTime;
      console.log(`[${rule.name}] PID ${child.pid} spawned after ${elapsed}ms`);
    });

    // Lifecycle event: stdout data
    child.stdout?.on('data', (data) => {
      const chunk = data.toString();
      stdout += chunk;
      console.log(`[${rule.name}] stdout chunk: ${chunk.length} bytes`);
    });

    // Lifecycle event: stderr data
    child.stderr?.on('data', (data) => {
      const chunk = data.toString();
      stderr += chunk;
      console.log(`[${rule.name}] stderr chunk: ${chunk.length} bytes`);
    });

    // Lifecycle event: exit (process terminated)
    child.on('exit', (code, signal) => {
      const elapsed = Date.now() - startTime;
      console.log(`[${rule.name}] Exit after ${elapsed}ms: code=${code} signal=${signal}`);
    });

    // Lifecycle event: close (all stdio closed)
    child.on('close', (code, signal) => {
      const elapsed = Date.now() - startTime;
      console.log(`[${rule.name}] Close after ${elapsed}ms: code=${code} signal=${signal}`);
      console.log(`[${rule.name}] stdout: ${stdout.length} bytes, stderr: ${stderr.length} bytes`);
      
      if (timedOut) {
        console.log(`[${rule.name}] Resolution: TIMEOUT (already handled)`);
        return; // Already resolved by timeout
      }

      resolve({
        rule: rule.name,
        gate: rule.gate,
        passed: code === 0,
        output: stdout || stderr,
        exitCode: code || 0,
      });
    });

    // Lifecycle event: error (spawn failure)
    child.on('error', (error) => {
      const elapsed = Date.now() - startTime;
      console.log(`[${rule.name}] Error after ${elapsed}ms: ${error.message}`);
      
      if (timedOut) {
        console.log(`[${rule.name}] Resolution: ERROR (but timeout already handled)`);
        return;
      }

      resolve({
        rule: rule.name,
        gate: rule.gate,
        passed: false,
        output: `Spawn error: ${error.message}\nHint: Check if tsx exists at ${tsxPath}`,
        exitCode: 1,
      });
    });

    // Timeout after 60s per rule
    const timeoutHandle = setTimeout(() => {
      const elapsed = Date.now() - startTime;
      console.log(`[${rule.name}] TIMEOUT after ${elapsed}ms, killing PID ${child.pid}`);
      timedOut = true;
      
      child.kill('SIGTERM');
      
      // Force kill after 5s if SIGTERM doesn't work
      setTimeout(() => {
        if (!child.killed) {
          console.log(`[${rule.name}] SIGTERM failed, sending SIGKILL to PID ${child.pid}`);
          child.kill('SIGKILL');
        }
      }, 5000);

      resolve({
        rule: rule.name,
        gate: rule.gate,
        passed: false,
        output: `Rule execution timeout (60s)\nstdout: ${stdout}\nstderr: ${stderr}`,
        exitCode: 1,
      });
    }, 60000);

    // Clear timeout if process completes
    child.on('close', () => {
      clearTimeout(timeoutHandle);
    });
  });
}

/**
 * Execute all rules in parallel and aggregate results by gate
 * WITH CANONICAL SCOPE WIRING (fail-closed)
 */
async function executeAllRules(
  configPath?: string,
  scope?: string
): Promise<Map<string, GateResult>> {
  const gateResults = new Map<string, GateResult>();

  // Initialize gate results
  for (const rule of RULES) {
    if (!gateResults.has(rule.gate)) {
      gateResults.set(rule.gate, {
        gate: rule.gate,
        rulesExecuted: 0,
        rulesPassed: 0,
        rulesFailed: 0,
        executions: [],
      });
    }
  }

  // P2: CANONICAL SCOPE WIRING VALIDATION
  // Rule 7 (Diagnostic Inventory) REQUIRES scope parameter
  // Without scope, Rule 7 would scan entire repo (incorrect behavior)
  // FAIL CLOSED: Error if scope missing for scope-dependent rules
  const rule7 = RULES.find((r) => r.script.includes('g4-rule7'));
  if (rule7 && !scope) {
    console.error('\n✗ FATAL: Rule 7 (Diagnostic Inventory) requires --scope parameter');
    console.error('  Reason: Without scope, inventory would scan entire repo');
    console.error('  Usage: npm run governance:factory-rules -- --config=... --scope=file.ts');
    console.error('  Example: --scope=healthcare-actions.ts\n');
    
    throw new Error('CANONICAL SCOPE VIOLATION: Rule 7 requires --scope parameter (fail-closed)');
  }

  // Execute all rules in parallel
  const executions = await Promise.all(
    RULES.map((rule) => executeRuleAsync(rule, configPath, scope))
  );

  // Aggregate results
  for (const execution of executions) {
    const gate = RULES.find((r) => r.name === execution.rule)!.gate;
    const result = gateResults.get(gate)!;

    result.rulesExecuted++;
    if (execution.passed) {
      result.rulesPassed++;
    } else {
      result.rulesFailed++;
    }
    result.executions.push(execution);
  }

  return gateResults;
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  
  // Accept both --config=value and separate argv
  const configPath = args.find((arg) => arg.startsWith('--config='))?.split('=')[1]
    || (args.includes('--config') ? args[args.indexOf('--config') + 1] : undefined);
  
  // Accept both --scope=value and separate argv (handles paths with spaces)
  const scope = args.find((arg) => arg.startsWith('--scope='))?.split('=')[1]
    || (args.includes('--scope') ? args[args.indexOf('--scope') + 1] : undefined);
  
  const verbose = args.includes('--verbose');

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  FACTORY RULES GATE — Automated Type System Protection`);
  console.log(`${'═'.repeat(70)}\n`);

  if (configPath) {
    console.log(`Config: ${configPath}`);
  }
  if (scope) {
    console.log(`Scope: ${scope}`);
  }
  console.log(`Rules: ${RULES.length} automated rules`);
  console.log(`Execution: Parallel\n`);

  const gateResults = await executeAllRules(configPath, scope);

  // P3: Per-rule attribution for adversarial testing
  // Emit individual rule verdicts BEFORE gate aggregation
  // Critical for FN/FP calculation when multiple rules can BLOCK same fixture
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`PER-RULE VERDICTS (for adversarial metric attribution):`);
  console.log(`${'─'.repeat(70)}`);
  
  const allExecutions: RuleExecution[] = [];
  for (const [, result] of gateResults.entries()) {
    allExecutions.push(...result.executions);
  }
  
  // Sort by rule number for consistent output
  allExecutions.sort((a, b) => {
    const aNum = parseInt(a.rule.match(/Rule (\d+)/)?.[1] || '999');
    const bNum = parseInt(b.rule.match(/Rule (\d+)/)?.[1] || '999');
    return aNum - bNum;
  });
  
  for (const exec of allExecutions) {
    const verdict = exec.passed ? 'ALLOW' : 'BLOCK';
    const exitCode = exec.passed ? 0 : 2;
    const ruleShort = exec.rule.replace(/:\s.*$/, ''); // "Rule 2" instead of full name
    console.log(`  [${ruleShort}] exitCode=${exitCode} verdict=${verdict}`);
  }
  console.log(`${'─'.repeat(70)}\n`);

  let totalPassed = 0;
  let totalFailed = 0;

  for (const [gateName, result] of gateResults.entries()) {
    console.log(`\n${gateName}: ${result.rulesPassed}/${result.rulesExecuted} rules passed`);
    console.log(`${'─'.repeat(70)}`);

    for (const execution of result.executions) {
      const status = execution.passed ? '✓ PASS' : '✗ FAIL';
      console.log(`  ${status}: ${execution.rule}`);

      if (verbose || !execution.passed) {
        console.log(execution.output);
      }
    }

    totalPassed += result.rulesPassed;
    totalFailed += result.rulesFailed;
  }

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`SUMMARY: ${totalPassed}/${RULES.length} rules PASSED`);
  console.log(`${'═'.repeat(70)}\n`);

  if (totalFailed === 0) {
    console.log(`✓ ALL FACTORY RULES PASSED\n`);
    console.log(`Type system protection gates satisfied.`);
    console.log(`Product/Kernel manufacturing may proceed.\n`);
    process.exit(0);
  } else {
    console.log(`✗ ${totalFailed} FACTORY RULES FAILED\n`);
    console.log(`Type system violations detected.`);
    console.log(`Manufacturing BLOCKED until violations resolved.\n`);
    console.log(`Guidance:`);
    console.log(`  1. Review failed rule output above`);
    console.log(`  2. Follow rule-specific remediation guidance`);
    console.log(`  3. Do NOT use 'as any' or suppress errors`);
    console.log(`  4. Fix root cause, not symptom`);
    console.log(`  5. Re-run: npm run governance:factory-rules\n`);
    process.exit(2); // EXIT 2 = BLOCK
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('\n✗ FATAL ERROR:', error);
    process.exit(1);
  });
}

export { executeAllRules, executeRuleAsync, GateResult, RuleExecution };
