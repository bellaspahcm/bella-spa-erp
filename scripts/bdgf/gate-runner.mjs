/**
 * BDGF Gate Runner
 * 
 * Unified execution engine for all BDGF verification gates.
 * Config-driven, integrates with Check Registry and Evidence Collector.
 * 
 * @module bdgf/gate-runner
 */

import fs from 'fs/promises';
import path from 'path';
import { GateContract } from './gate-contract.mjs';
import { CheckRegistry } from './check-registry.mjs';

/**
 * Gate Runner - executes gates from configuration
 * 
 * Supports:
 * - Config-driven execution (JSON config)
 * - Parallel or sequential check execution
 * - Integration with Check Registry
 * - Automatic evidence collection
 * - Dry run mode
 */
export class GateRunner extends GateContract {
  /**
   * @param {Object} config - Gate Runner configuration
   * @param {string} config.gateName - Name of the gate
   * @param {string} config.gateVersion - Version of the gate
   * @param {string} config.deployment - Deployment identifier
   * @param {Object|string} config.config - Gate config object or path to JSON file
   * @param {boolean} [config.dryRun=false] - Dry run mode
   * @param {boolean} [config.parallel=false] - Execute checks in parallel
   */
  constructor({ gateName, gateVersion, deployment, config, dryRun = false, parallel = false }) {
    super({ gateName, gateVersion, deployment, config, dryRun });
    this.parallel = parallel;
    this.gateConfig = null;
  }

  /**
   * Validate gate configuration
   * @returns {Object} Validation result
   */
  validate() {
    const baseValidation = super.validate();
    const errors = [...baseValidation.errors];

    // Additional validation for Gate Runner
    if (!this.config) {
      errors.push('Gate configuration is required');
    }

    if (this.gateConfig) {
      // Validate checks array
      if (!Array.isArray(this.gateConfig.checks)) {
        errors.push('Gate config must have "checks" array');
      } else if (this.gateConfig.checks.length === 0) {
        errors.push('Gate config must have at least one check');
      }

      // Validate each check
      this.gateConfig.checks.forEach((check, index) => {
        if (!check.id) {
          errors.push(`Check at index ${index} missing "id"`);
        }
        if (!check.name) {
          errors.push(`Check at index ${index} missing "name"`);
        }
        if (!check.type) {
          errors.push(`Check at index ${index} missing "type"`);
        } else if (!CheckRegistry.has(check.type)) {
          errors.push(`Check at index ${index} has unknown type: ${check.type}`);
        }
      });

      // Validate minimum checks if specified
      if (this.gateConfig.minChecks && this.gateConfig.checks.length < this.gateConfig.minChecks) {
        errors.push(`Gate requires at least ${this.gateConfig.minChecks} checks, got ${this.gateConfig.checks.length}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Load gate configuration
   * @private
   * @returns {Promise<Object>} Gate configuration
   */
  async loadConfig() {
    // If config is already an object, use it
    if (typeof this.config === 'object' && this.config !== null) {
      return this.config;
    }

    // If config is a string, treat it as a file path
    if (typeof this.config === 'string') {
      const configPath = path.isAbsolute(this.config)
        ? this.config
        : path.join(process.cwd(), this.config);

      const configContent = await fs.readFile(configPath, 'utf-8');
      return JSON.parse(configContent);
    }

    throw new Error('Gate config must be an object or path to JSON file');
  }

  /**
   * Execute the gate
   * @returns {Promise<GateResult>} Gate execution result
   */
  async execute() {
    // Load configuration
    this.gateConfig = await this.loadConfig();

    this.evidenceCollector.log(`Gate: ${this.gateName}`);
    this.evidenceCollector.log(`Version: ${this.gateVersion}`);
    this.evidenceCollector.log(`Deployment: ${this.deployment}`);
    this.evidenceCollector.log(`Checks: ${this.gateConfig.checks.length}`);
    this.evidenceCollector.log(`Mode: ${this.dryRun ? 'DRY RUN' : 'LIVE'}`);
    this.evidenceCollector.log(`Execution: ${this.parallel ? 'PARALLEL' : 'SEQUENTIAL'}`);
    this.evidenceCollector.log('');

    // Execute checks
    if (this.parallel) {
      await this.executeChecksParallel();
    } else {
      await this.executeChecksSequential();
    }

    // Finalize and return result
    return this.finalize();
  }

  /**
   * Execute checks sequentially
   * @private
   */
  async executeChecksSequential() {
    for (const checkConfig of this.gateConfig.checks) {
      await this.executeCheck(checkConfig);
    }
  }

  /**
   * Execute checks in parallel
   * @private
   */
  async executeChecksParallel() {
    const checkPromises = this.gateConfig.checks.map(checkConfig =>
      this.executeCheck(checkConfig)
    );

    await Promise.all(checkPromises);
  }

  /**
   * Execute a single check
   * @private
   * @param {Object} checkConfig - Check configuration
   */
  async executeCheck(checkConfig) {
    const { id, name, type, config = {}, failOn, severity = 'error' } = checkConfig;

    try {
      // Skip check in dry run if configured
      if (this.dryRun && checkConfig.skipInDryRun) {
        this.recordCheck(id, 'WARN', { name, skipped: true }, 'Skipped in dry run');
        return;
      }

      // Execute check via Check Registry
      const result = await CheckRegistry.execute(type, {
        id,
        name,
        ...config,
        failOn
      });

      // Record result
      this.recordCheck(
        id,
        result.status,
        result.evidence,
        result.message
      );

      // Handle severity
      if (result.status === 'FAIL' && severity === 'warning') {
        // Downgrade to warning
        this.evidenceCollector.log(`Note: Check ${id} failed but severity is "warning"`);
      }

    } catch (error) {
      // Check execution failed
      this.recordCheck(
        id,
        'FAIL',
        { error: error.message, stack: error.stack },
        `Check execution error: ${error.message}`
      );
    }
  }

  /**
   * Get gate configuration
   * @returns {Object|null} Gate configuration (null if not loaded)
   */
  getGateConfig() {
    return this.gateConfig;
  }

  /**
   * Get check count
   * @returns {number} Number of checks in configuration
   */
  getCheckCount() {
    return this.gateConfig?.checks.length || 0;
  }

  /**
   * Check if gate passed minimum check threshold
   * @returns {boolean} True if minimum checks met
   */
  passedMinimumChecks() {
    if (!this.gateConfig?.minChecks) {
      return true; // No minimum specified
    }

    return this.getCheckCount() >= this.gateConfig.minChecks;
  }
}

/**
 * Helper function to run a gate from config file
 * 
 * @param {string} configPath - Path to gate configuration file
 * @param {Object} [options] - Additional options
 * @param {boolean} [options.dryRun=false] - Dry run mode
 * @param {boolean} [options.parallel=false] - Parallel execution
 * @returns {Promise<GateResult>} Gate execution result
 */
export async function runGateFromConfig(configPath, options = {}) {
  // Load config to get gate metadata
  const configContent = await fs.readFile(configPath, 'utf-8');
  const config = JSON.parse(configContent);

  if (!config.gateName) {
    throw new Error('Gate config must have "gateName" field');
  }
  if (!config.gateVersion) {
    throw new Error('Gate config must have "gateVersion" field');
  }
  if (!config.deployment) {
    throw new Error('Gate config must have "deployment" field');
  }

  // Create and run gate
  const gate = new GateRunner({
    gateName: config.gateName,
    gateVersion: config.gateVersion,
    deployment: config.deployment,
    config: configPath,
    dryRun: options.dryRun || false,
    parallel: options.parallel || false
  });

  return gate.run();
}

/**
 * Helper function to run multiple gates sequentially
 * 
 * @param {string[]} configPaths - Array of gate configuration file paths
 * @param {Object} [options] - Additional options
 * @returns {Promise<GateResult[]>} Array of gate execution results
 */
export async function runGates(configPaths, options = {}) {
  const results = [];

  for (const configPath of configPaths) {
    const result = await runGateFromConfig(configPath, options);
    results.push(result);

    // Stop on first failure if configured
    if (options.stopOnFailure && result.status === 'FAIL') {
      console.log(`\nStopping gate execution due to failure in: ${result.gateName}`);
      break;
    }
  }

  return results;
}

/**
 * Helper function to print gate result summary
 * 
 * @param {GateResult} result - Gate execution result
 */
export function printGateSummary(result) {
  const statusIcon = result.status === 'PASS' ? '✅' :
                     result.status === 'FAIL' ? '❌' :
                     result.status === 'WARN' ? '⚠️' :
                     result.status === 'HOLD' ? '🟡' :
                     result.status === 'BLOCKED' ? '🔴' : '❓';

  console.log(`\n${'='.repeat(80)}`);
  console.log(`${statusIcon} ${result.gateName} v${result.gateVersion}`);
  console.log(`${'='.repeat(80)}`);
  console.log(`Status: ${result.status}`);
  console.log(`Deployment: ${result.deployment}`);
  console.log(`Checks: ${result.checks.pass}/${result.checks.total} PASS`);

  if (result.checks.fail > 0) {
    console.log(`Failures: ${result.checks.fail}`);
  }
  if (result.checks.warn > 0) {
    console.log(`Warnings: ${result.checks.warn}`);
  }

  console.log(`Duration: ${(result.duration / 1000).toFixed(2)}s`);
  console.log(`Timestamp: ${result.timestamp}`);
  console.log(`Evidence: ${result.evidence.artifacts.evidenceFile || 'N/A'}`);
  console.log(`${'='.repeat(80)}\n`);
}

/**
 * Helper function to print multiple gate results summary
 * 
 * @param {GateResult[]} results - Array of gate execution results
 */
export function printGatesSummary(results) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`GATE EXECUTION SUMMARY`);
  console.log(`${'='.repeat(80)}`);
  console.log(`Total Gates: ${results.length}`);
  console.log(`Passed: ${results.filter(r => r.status === 'PASS').length}`);
  console.log(`Failed: ${results.filter(r => r.status === 'FAIL').length}`);
  console.log(`Warnings: ${results.filter(r => r.status === 'WARN').length}`);
  console.log(`Held: ${results.filter(r => r.status === 'HOLD').length}`);
  console.log(`Blocked: ${results.filter(r => r.status === 'BLOCKED').length}`);
  console.log('');

  // Total checks
  const totalChecks = results.reduce((sum, r) => sum + r.checks.total, 0);
  const totalPass = results.reduce((sum, r) => sum + r.checks.pass, 0);
  const totalFail = results.reduce((sum, r) => sum + r.checks.fail, 0);
  const totalWarn = results.reduce((sum, r) => sum + r.checks.warn, 0);

  console.log(`Total Checks: ${totalPass}/${totalChecks} PASS`);
  if (totalFail > 0) {
    console.log(`Total Failures: ${totalFail}`);
  }
  if (totalWarn > 0) {
    console.log(`Total Warnings: ${totalWarn}`);
  }

  // Duration
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  console.log(`Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);

  console.log(`${'='.repeat(80)}\n`);

  // Print individual gate summaries
  results.forEach(result => printGateSummary(result));
}
