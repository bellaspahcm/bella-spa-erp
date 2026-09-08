/**
 * BELLA FACTORY — EVIDENCE COLLECTOR
 * 
 * Aggregate evidence from existing tool outputs → reproducible bundle
 * 
 * Principles:
 * - Read-only operations (no tool execution)
 * - No qualification judgments
 * - Deterministic where inputs are deterministic
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  parseArchitectureGuard,
  parseBuild,
  parseTests,
} from './evidence-adapters';
import type {
  ProductEvidenceBundle,
  EvidenceCollectorConfig,
  IEvidenceCollector,
} from './evidence-contract';

// ============================================================================
// EVIDENCE COLLECTOR IMPLEMENTATION
// ============================================================================

export class BellaEvidenceCollector implements IEvidenceCollector {
  /**
   * Collect evidence from existing tool outputs
   * 
   * Contract: Read-only, no tool execution
   */
  async collect(config: EvidenceCollectorConfig): Promise<{
    bundle: ProductEvidenceBundle;
    bundlePath: string;
  }> {
    // Build bundle with user-provided identity
    const bundle: ProductEvidenceBundle = {
      productId: config.productId,
      version: config.version,
      specHash: config.specHash,
      collectionTimestamp: new Date().toISOString(),
      execution: {
        gitCommit: config.gitCommit,
        nodeVersion: config.nodeVersion || process.version,
        toolVersions: config.toolVersions,
      },
    };

    // Collect Architecture Guard evidence (if output file exists)
    const guardOutput = this.readToolOutput('.factory/outputs/arch-guard.txt');
    if (guardOutput) {
      bundle.architectureGuard = parseArchitectureGuard(
        guardOutput.stdout,
        guardOutput.exitCode,
        guardOutput.timedOut
      );
    }

    // Collect Build evidence (if output file exists)
    const buildOutput = this.readToolOutput('.factory/outputs/build.txt');
    if (buildOutput) {
      bundle.build = parseBuild(buildOutput.stdout, buildOutput.exitCode);
    }

    // Collect Test evidence (if Jest JSON exists)
    const testOutput = this.readToolOutput('.factory/outputs/tests.json');
    if (testOutput) {
      try {
        const jestJson = JSON.parse(testOutput.stdout);
        bundle.tests = parseTests(jestJson);
      } catch (err) {
        console.warn('Failed to parse Jest JSON:', err);
      }
    }

    // Write bundle to disk
    const outputDir = path.dirname(config.outputPath || '');
    if (outputDir && !fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const bundlePath =
      config.outputPath ||
      path.join('.factory/evidence', `${config.productId}-${timestamp}.json`);

    fs.writeFileSync(bundlePath, JSON.stringify(bundle, null, 2), 'utf-8');

    return { bundle, bundlePath };
  }

  /**
   * Load existing evidence bundle from disk
   */
  load(bundlePath: string): ProductEvidenceBundle {
    const content = fs.readFileSync(bundlePath, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * Read tool output from file (if exists)
   * 
   * Expected format: { stdout: string, exitCode: number, timedOut?: boolean }
   * OR plain text (exitCode=0, timedOut=false assumed)
   */
  private readToolOutput(
    filePath: string
  ): { stdout: string; exitCode: number; timedOut: boolean } | null {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const content = fs.readFileSync(filePath, 'utf-8');

    // Try parsing as JSON first
    try {
      const parsed = JSON.parse(content);
      return {
        stdout: parsed.stdout || content,
        exitCode: parsed.exitCode || 0,
        timedOut: parsed.timedOut || false,
      };
    } catch {
      // Plain text file (assume success)
      return {
        stdout: content,
        exitCode: 0,
        timedOut: false,
      };
    }
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create evidence collector instance
 */
export function createEvidenceCollector(): IEvidenceCollector {
  return new BellaEvidenceCollector();
}
