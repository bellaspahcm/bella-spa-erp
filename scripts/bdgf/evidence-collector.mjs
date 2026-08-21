/**
 * BDGF Evidence Collector
 * 
 * Automatically collect, structure, and archive verification evidence.
 * All gates use this to maintain consistent evidence format.
 * 
 * @module bdgf/evidence-collector
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Evidence collector for gate execution
 * 
 * Responsibilities:
 * - Record check results with timestamps
 * - Calculate summary statistics
 * - Archive evidence to evidence/[deployment]/[gate]/
 * - Generate JSON + human-readable log
 */
export class EvidenceCollector {
  /**
   * @param {Object} config - Collector configuration
   * @param {string} config.deployment - Deployment identifier
   * @param {string} config.gate - Gate name
   * @param {string} [config.evidenceBasePath] - Base path for evidence (default: evidence/)
   */
  constructor({ deployment, gate, evidenceBasePath }) {
    if (!deployment) throw new Error('deployment is required');
    if (!gate) throw new Error('gate is required');

    this.deployment = deployment;
    this.gate = gate;
    this.evidenceBasePath = evidenceBasePath || path.join(process.cwd(), 'evidence');
    
    this.checks = [];
    this.startTime = new Date().toISOString();
    this.logs = [];
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
    const check = {
      id: checkId,
      name: evidence?.name || checkId,
      status,
      evidence,
      message: message || '',
      timestamp: new Date().toISOString()
    };

    this.checks.push(check);

    // Also add to logs
    this.log(`[${status}] ${check.name}${message ? ': ' + message : ''}`);
  }

  /**
   * Add a log entry
   * 
   * @param {string} message - Log message
   */
  log(message) {
    const timestamp = new Date().toISOString();
    this.logs.push({ timestamp, message });
  }

  /**
   * Calculate summary statistics
   * 
   * @returns {Object} Summary object
   */
  calculateSummary() {
    const total = this.checks.length;
    const pass = this.checks.filter(c => c.status === 'PASS').length;
    const fail = this.checks.filter(c => c.status === 'FAIL').length;
    const warn = this.checks.filter(c => c.status === 'WARN').length;

    return { total, pass, fail, warn };
  }

  /**
   * Finalize evidence collection and archive
   * 
   * @returns {Promise<Object>} Evidence object
   */
  async finalize() {
    const endTime = new Date().toISOString();
    const summary = this.calculateSummary();

    // Build evidence object
    const evidence = {
      deployment: this.deployment,
      gate: this.gate,
      startTime: this.startTime,
      endTime,
      checks: this.checks,
      summary,
      logs: this.logs,
      artifacts: {}
    };

    // Archive evidence
    const evidencePath = path.join(
      this.evidenceBasePath,
      this.deployment,
      this.gate
    );

    await fs.mkdir(evidencePath, { recursive: true });

    // Generate timestamp for filenames
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    // Write JSON evidence
    const evidenceFile = path.join(evidencePath, `${timestamp}.json`);
    await fs.writeFile(
      evidenceFile,
      JSON.stringify(evidence, null, 2),
      'utf-8'
    );
    evidence.artifacts.evidenceFile = evidenceFile;

    // Write human-readable log
    const logFile = path.join(evidencePath, `${timestamp}.log`);
    const logContent = this.generateLogContent(evidence);
    await fs.writeFile(logFile, logContent, 'utf-8');
    evidence.artifacts.logFile = logFile;

    // Write summary file (latest.json for easy access)
    const latestFile = path.join(evidencePath, 'latest.json');
    await fs.writeFile(
      latestFile,
      JSON.stringify(evidence, null, 2),
      'utf-8'
    );
    evidence.artifacts.latestFile = latestFile;

    return evidence;
  }

  /**
   * Generate human-readable log content
   * 
   * @param {Object} evidence - Evidence object
   * @returns {string} Log content
   */
  generateLogContent(evidence) {
    const lines = [];

    lines.push('='.repeat(80));
    lines.push(`BDGF EVIDENCE LOG`);
    lines.push('='.repeat(80));
    lines.push('');
    lines.push(`Deployment: ${evidence.deployment}`);
    lines.push(`Gate: ${evidence.gate}`);
    lines.push(`Start Time: ${evidence.startTime}`);
    lines.push(`End Time: ${evidence.endTime}`);
    lines.push('');
    lines.push(`Summary:`);
    lines.push(`  Total Checks: ${evidence.summary.total}`);
    lines.push(`  Pass: ${evidence.summary.pass}`);
    lines.push(`  Fail: ${evidence.summary.fail}`);
    lines.push(`  Warn: ${evidence.summary.warn}`);
    lines.push('');
    lines.push('='.repeat(80));
    lines.push('CHECK RESULTS');
    lines.push('='.repeat(80));
    lines.push('');

    // Group checks by status
    const passed = evidence.checks.filter(c => c.status === 'PASS');
    const failed = evidence.checks.filter(c => c.status === 'FAIL');
    const warnings = evidence.checks.filter(c => c.status === 'WARN');

    if (failed.length > 0) {
      lines.push(`FAILED CHECKS (${failed.length}):`);
      lines.push('-'.repeat(80));
      failed.forEach(check => {
        lines.push(`✗ ${check.name} [${check.id}]`);
        if (check.message) {
          lines.push(`  Message: ${check.message}`);
        }
        if (check.evidence && typeof check.evidence === 'object') {
          lines.push(`  Evidence: ${JSON.stringify(check.evidence, null, 2).split('\n').join('\n  ')}`);
        }
        lines.push(`  Timestamp: ${check.timestamp}`);
        lines.push('');
      });
      lines.push('');
    }

    if (warnings.length > 0) {
      lines.push(`WARNINGS (${warnings.length}):`);
      lines.push('-'.repeat(80));
      warnings.forEach(check => {
        lines.push(`⚠ ${check.name} [${check.id}]`);
        if (check.message) {
          lines.push(`  Message: ${check.message}`);
        }
        lines.push(`  Timestamp: ${check.timestamp}`);
        lines.push('');
      });
      lines.push('');
    }

    if (passed.length > 0) {
      lines.push(`PASSED CHECKS (${passed.length}):`);
      lines.push('-'.repeat(80));
      passed.forEach(check => {
        lines.push(`✓ ${check.name} [${check.id}]`);
        if (check.message) {
          lines.push(`  Message: ${check.message}`);
        }
        lines.push('');
      });
      lines.push('');
    }

    lines.push('='.repeat(80));
    lines.push('LOG ENTRIES');
    lines.push('='.repeat(80));
    lines.push('');

    evidence.logs.forEach(log => {
      lines.push(`[${log.timestamp}] ${log.message}`);
    });

    lines.push('');
    lines.push('='.repeat(80));
    lines.push('END OF EVIDENCE LOG');
    lines.push('='.repeat(80));

    return lines.join('\n');
  }

  /**
   * Get current check count
   * @returns {number} Number of checks recorded
   */
  getCheckCount() {
    return this.checks.length;
  }

  /**
   * Get checks by status
   * @param {'PASS'|'FAIL'|'WARN'} status - Status to filter by
   * @returns {Array} Checks with specified status
   */
  getChecksByStatus(status) {
    return this.checks.filter(c => c.status === status);
  }

  /**
   * Check if any checks failed
   * @returns {boolean} True if at least one check failed
   */
  hasFailures() {
    return this.checks.some(c => c.status === 'FAIL');
  }

  /**
   * Check if any checks have warnings
   * @returns {boolean} True if at least one check has warning
   */
  hasWarnings() {
    return this.checks.some(c => c.status === 'WARN');
  }
}
