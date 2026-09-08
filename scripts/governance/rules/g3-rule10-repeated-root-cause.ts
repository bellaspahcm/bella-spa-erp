#!/usr/bin/env node
/**
 * Factory Rule 10: Repeated Root-Cause Occurrence Guard
 * 
 * Gate: G3 (Verification)
 * Status: AUTOMATED
 * 
 * Detects:
 * - Same error code at N > 3 locations (pattern threshold)
 * - Same error message pattern across multiple functions
 * - Repeated type narrowing failures
 * 
 * Evidence: Dental incident `party?.id` pattern at 4+ locations
 */

import * as ts from 'typescript';
import * as path from 'path';

interface ErrorPattern {
  code: number;
  messagePattern: string;
  occurrences: ErrorOccurrence[];
}

interface ErrorOccurrence {
  file: string;
  line: number;
  column: number;
  fullMessage: string;
}

interface PatternResult {
  passed: boolean;
  patterns: ErrorPattern[];
  violations: string[];
  summary: string;
}

const PATTERN_THRESHOLD = 3; // N > 3 occurrences = pattern

/**
 * Extract error patterns from diagnostics
 */
function extractPatterns(
  diagnostics: readonly ts.Diagnostic[]
): Map<string, ErrorPattern> {
  const patternMap = new Map<string, ErrorPattern>();

  for (const diagnostic of diagnostics) {
    if (!diagnostic.file) continue;

    const fullMessage = ts.flattenDiagnosticMessageText(
      diagnostic.messageText,
      '\n'
    );

    // Extract semantic pattern (remove specific variable names)
    const messagePattern = fullMessage
      .replace(/'[^']+'/g, "'<identifier>'") // Replace quoted identifiers
      .replace(/\d+/g, '<number>'); // Replace numbers

    const patternKey = `${diagnostic.code}:${messagePattern}`;
    
    const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(
      diagnostic.start!
    );

    const occurrence: ErrorOccurrence = {
      file: diagnostic.file.fileName,
      line: line + 1,
      column: character + 1,
      fullMessage,
    };

    if (!patternMap.has(patternKey)) {
      patternMap.set(patternKey, {
        code: diagnostic.code,
        messagePattern,
        occurrences: [occurrence],
      });
    } else {
      const pattern = patternMap.get(patternKey)!;
      pattern.occurrences.push(occurrence);
    }
  }

  return patternMap;
}

/**
 * Detect repeated patterns that require scope-wide fix
 */
function detectRepeatedPatterns(configPath: string): PatternResult {
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  
  if (configFile.error) {
    throw new Error(`Failed to read tsconfig: ${configFile.error.messageText}`);
  }

  const parsedConfig = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(configPath)
  );

  const program = ts.createProgram({
    rootNames: parsedConfig.fileNames,
    options: parsedConfig.options,
  });

  const diagnostics = ts.getPreEmitDiagnostics(program);
  const patternMap = extractPatterns(diagnostics);

  const repeatedPatterns: ErrorPattern[] = [];
  const violations: string[] = [];

  for (const pattern of patternMap.values()) {
    if (pattern.occurrences.length > PATTERN_THRESHOLD) {
      repeatedPatterns.push(pattern);
      violations.push(
        `Pattern TS${pattern.code} repeated ${pattern.occurrences.length} times (threshold: ${PATTERN_THRESHOLD})`
      );
    }
  }

  return {
    passed: violations.length === 0,
    patterns: repeatedPatterns,
    violations,
    summary: `Repeated Pattern Guard: ${repeatedPatterns.length} patterns above threshold`,
  };
}

/**
 * Main execution
 */
function main() {
  const args = process.argv.slice(2);
  const configPath = args[0] || 'tsconfig.json';

  console.log(`\n═════════════════════════════════════════════════════════`);
  console.log(`  FACTORY RULE 10: Repeated Root-Cause Occurrence (G3)`);
  console.log(`═════════════════════════════════════════════════════════\n`);

  console.log(`Config: ${configPath}`);
  console.log(`Pattern threshold: N > ${PATTERN_THRESHOLD} occurrences`);
  console.log(`Scanning for repeated error patterns...\n`);

  try {
    const result = detectRepeatedPatterns(configPath);

    if (result.passed) {
      console.log(`✓ PASS: No repeated patterns above threshold\n`);
      process.exit(0);
    } else {
      console.log(`✗ FAIL: ${result.patterns.length} repeated patterns detected\n`);

      for (const pattern of result.patterns) {
        console.log(`Pattern: TS${pattern.code} (${pattern.occurrences.length} occurrences)`);
        console.log(`  Message: ${pattern.messagePattern.substring(0, 80)}...`);
        console.log(`  Locations:`);
        
        for (const occurrence of pattern.occurrences) {
          const relPath = path.relative(process.cwd(), occurrence.file);
          console.log(`    - ${relPath}:${occurrence.line}:${occurrence.column}`);
        }
        console.log(``);
      }

      console.log(`Rule 10 Guidance:`);
      console.log(`  1. Do NOT fix occurrence-by-occurrence`);
      console.log(`  2. Investigate common root cause (upstream producer)`);
      console.log(`  3. Do scope-wide search for ALL occurrences`);
      console.log(`  4. Apply systematic fix to eliminate pattern`);
      console.log(`  5. Re-run verification to confirm pattern eliminated\n`);

      process.exit(2); // EXIT 2 = BLOCK
    }
  } catch (error) {
    console.error(`\n✗ ERROR: Rule execution failed`);
    console.error(error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { detectRepeatedPatterns, extractPatterns, PatternResult, ErrorPattern };
