/**
 * BDGF Gate Contract
 * 
 * Standard interface enforced for all BDGF verification gates.
 * All gates must extend this contract and implement execute().
 * 
 * @module bdgf/gate-contract
 */

import { EvidenceCollector } from './evidence-collector.mjs';

/**
 * Gate execution result structure
 * @typedef {Object} GateResult
 * @property {string} gateName - Name of the gate
 * @property {string} gateVersion - Version of the gate
 * @property {string} deployment - Deployment identifier
 * @property {'PASS'|'FAIL'|'HOLD'|'BLOCKED'|'WARN'} status - Gate status
 * @property {string} timestamp - ISO8601 timestamp
 * @property {Object} checks - Check counts
 * @property {number} checks.total - Total checks executed
 * @property {number} checks.pass - Checks that passed
 * @property {number} checks.fail - Checks that failed
 * @property {number} checks.warn - Checks with warnings
 * @property {Object} evidence - Evidence object
 * @property {number} duration - Execution duration in milliseconds
 */

/**
 * Abstract base class for all BDGF gates
 * 
 * Enforces standard interface:
 * - execute() method (must implement)
 * - recordCheck() method (inherited)
 * - finalize() method (inherited)
 * - validate() method (inherited)
 */
export class GateContract {
  /**
   * @param {Object} config - Gate configuration
   * @param {string} config.gateName - Name of the gate
   * @param {string} config.gateVersion - Version of the gate
   * @param {string} config.deployment - Deployment identifier
   * @param {Object} config.config - Gate-specific configuration
   * @param {boolean} [config.dryRun=false] - Dry run mode (no side effects)
   */
  constructor({ gateName, gateVersion, deployment, config, dryRun = false }) {
    if (!gateName) throw new Error('gateName is required');
    if (!gateVersion) throw new Error('gateVersion is required');
    if (!deployment) throw new Error('deployment is required');

    this.gateName = gateName;
    this.gateVersion = gateVersion;
    this.deployment = deployment;
    this.config = config || {};
    this.dryRun = dryRun;

    this.startTime = null;
    this.endTime = null;

    // Initialize evidence collector
    this.evidenceCollector = new EvidenceCollector({
      deployment,
      gate: gateName
    });
  }

  /**
   * Validate gate configuration
   * Override in subclasses to add custom validation
   * 
   * @returns {Object} Validation result
   * @returns {boolean} result.valid - Whether config is valid
   * @returns {string[]} result.errors - Validation errors
   */
  validate() {
    const errors = [];

    // Base validation (can be extended by subclasses)
    if (!this.gateName) errors.push('gateName is required');
    if (!this.gateVersion) errors.push('gateVersion is required');
    if (!this.deployment) errors.push('deployment is required');

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Execute the gate
   * MUST be implemented by subclasses
   * 
   * @abstract
   * @returns {Promise<GateResult>} Gate execution result
   */
  async execute() {
    throw new Error('execute() must be implemented by subclass');
  }

  /**
   * Run the gate with timing and error handling
   * 
   * @returns {Promise<GateResult>} Gate execution result
   */
  async run() {
    // Validate configuration
    const validation = this.validate();
    if (!validation.valid) {
      throw new Error(`Gate configuration invalid: ${validation.errors.join(', ')}`);
    }

    // Start timing
    this.startTime = Date.now();

    try {
      console.log(`\n[${ this.gateName}] Starting gate execution...`);
      console.log(`Deployment: ${this.deployment}`);
      console.log(`Version: ${this.gateVersion}`);
      if (this.dryRun) {
        console.log(`Mode: DRY RUN`);
      }
      console.log('');

      // Execute gate (implemented by subclass)
      const result = await this.execute();

      // End timing
      this.endTime = Date.now();

      // Return result
      return result;
    } catch (error) {
      this.endTime = Date.now();

      console.error(`\n[${this.gateName}] Gate execution failed:`, error.message);

      // Return FAIL result
      return this.finalize({
        status: 'FAIL',
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * Record a check result
   * 
   * @param {string} checkId - Unique check identifier
   * @param {'PASS'|'FAIL'|'WARN'} status - Check status
   * @param {*} evidence - Evidence object (any structure)
   * @param {string} [message] - Optional message
   */
  recordCheck(checkId, status, evidence, message) {
    this.evidenceCollector.recordCheck(checkId, status, evidence, message);

    // Log to console
    const icon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '⚠';
    const checkName = evidence?.name || checkId;
    console.log(`  ${icon} ${checkName}: ${status}${message ? ` - ${message}` : ''}`);
  }

  /**
   * Finalize gate execution and return result
   * 
   * @param {Object} [overrides] - Override values for result
   * @returns {Promise<GateResult>} Gate execution result
   */
  async finalize(overrides = {}) {
    // Finalize evidence collection
    const evidence = await this.evidenceCollector.finalize();

    // Calculate duration
    const duration = this.endTime ? this.endTime - this.startTime : 0;

    // Determine status if not overridden
    let status = overrides.status;
    if (!status) {
      if (evidence.summary.fail > 0) {
        status = 'FAIL';
      } else if (evidence.summary.warn > 0) {
        status = 'WARN';
      } else if (evidence.summary.pass > 0) {
        status = 'PASS';
      } else {
        status = 'BLOCKED';
      }
    }

    // Build result
    const result = {
      gateName: this.gateName,
      gateVersion: this.gateVersion,
      deployment: this.deployment,
      status,
      timestamp: new Date().toISOString(),
      checks: {
        total: evidence.summary.total,
        pass: evidence.summary.pass,
        fail: evidence.summary.fail,
        warn: evidence.summary.warn
      },
      evidence: {
        checkResults: evidence.checks,
        artifacts: evidence.artifacts,
        logs: evidence.logs
      },
      duration,
      ...overrides
    };

    // Log summary
    console.log(`\n[${this.gateName}] Gate execution complete`);
    console.log(`Status: ${result.status}`);
    console.log(`Checks: ${result.checks.pass}/${result.checks.total} PASS`);
    if (result.checks.fail > 0) {
      console.log(`Failures: ${result.checks.fail}`);
    }
    if (result.checks.warn > 0) {
      console.log(`Warnings: ${result.checks.warn}`);
    }
    console.log(`Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log(`Evidence: ${evidence.artifacts.evidenceFile}`);
    console.log('');

    return result;
  }

  /**
   * Get gate configuration
   * @returns {Object} Gate configuration
   */
  getConfig() {
    return this.config;
  }

  /**
   * Get deployment identifier
   * @returns {string} Deployment identifier
   */
  getDeployment() {
    return this.deployment;
  }

  /**
   * Check if running in dry run mode
   * @returns {boolean} True if dry run
   */
  isDryRun() {
    return this.dryRun;
  }
}

/**
 * Gate status enumeration
 */
export const GateStatus = {
  PASS: 'PASS',       // All checks passed
  FAIL: 'FAIL',       // At least one check failed
  HOLD: 'HOLD',       // Checks passed, awaiting authorization
  BLOCKED: 'BLOCKED', // Cannot proceed (dependency failed)
  WARN: 'WARN',       // Passed with warnings
  SKIP: 'SKIP'        // Gate skipped (conditional)
};

/**
 * Check status enumeration
 */
export const CheckStatus = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  WARN: 'WARN'
};
