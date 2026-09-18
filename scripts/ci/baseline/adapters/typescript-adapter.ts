/**
 * TYPESCRIPT ADAPTER
 * 
 * Parses TypeScript compiler (tsc) output and generates stable fingerprints
 * 
 * Input: tsc --noEmit output (stderr text)
 * Output: FindingIdentity[] with stable fingerprints
 * 
 * Fingerprint strategy:
 * - file + code + symbol + message_sig
 * - Line/column stored but NOT part of identity
 * - Message signature captures semantic structure
 */

import { FindingIdentity, TypeScriptComponents } from '../schema';
import { completeFinding, generateMessageSignature } from '../fingerprint';

/**
 * Raw TypeScript diagnostic from tsc output
 */
interface RawTSDiagnostic {
  file: string;
  line: number;
  column: number;
  code: string;        // TS2353, TS2322, etc.
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Parse tsc output into raw diagnostics
 * 
 * Expected format:
 * src/file.ts(77,5): error TS2353: Object literal may only specify known properties...
 */
export function parseTSCOutput(output: string): RawTSDiagnostic[] {
  const diagnostics: RawTSDiagnostic[] = [];
  const lines = output.split('\n');
  
  // Regex: file.ts(line,col): error/warning TScode: message
  const pattern = /^(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.+)$/;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    const match = pattern.exec(trimmed);
    if (match) {
      const [, file, lineStr, colStr, severity, code, message] = match;
      
      diagnostics.push({
        file: file.trim(),
        line: parseInt(lineStr, 10),
        column: parseInt(colStr, 10),
        code,
        message: message.trim(),
        severity: severity as 'error' | 'warning'
      });
    }
  }
  
  return diagnostics;
}

/**
 * Extract symbol from TypeScript error message
 * 
 * Patterns:
 * - "Property 'X' does not exist" → X
 * - "Type 'X' is not assignable" → X
 * - "Cannot find name 'X'" → X
 * - "Object literal may only specify known properties, and 'X'" → X
 */
export function extractSymbol(message: string): string | undefined {
  // Pattern 1: Property 'X'
  let match = /'([^']+)'\s+does\s+not\s+exist/i.exec(message);
  if (match) return match[1];
  
  // Pattern 2: Type 'X' is not assignable
  match = /Type\s+'([^']+)'\s+is\s+not\s+assignable/i.exec(message);
  if (match) return match[1];
  
  // Pattern 3: Cannot find name 'X'
  match = /Cannot\s+find\s+name\s+'([^']+)'/i.exec(message);
  if (match) return match[1];
  
  // Pattern 4: known properties, and 'X'
  match = /known\s+properties,\s+and\s+'([^']+)'/i.exec(message);
  if (match) return match[1];
  
  // Pattern 5: Argument of type 'X'
  match = /Argument\s+of\s+type\s+'([^']+)'/i.exec(message);
  if (match) return match[1];
  
  // Pattern 6: Parameter 'X'
  match = /Parameter\s+'([^']+)'/i.exec(message);
  if (match) return match[1];
  
  return undefined;
}

/**
 * Convert raw diagnostic to FindingIdentity with stable fingerprint
 */
export function convertToFinding(diagnostic: RawTSDiagnostic): FindingIdentity {
  const { file, line, column, code, message, severity } = diagnostic;
  
  // Extract symbol for better fingerprint specificity
  const symbol = extractSymbol(message);
  
  // Generate semantic message signature
  const message_sig = generateMessageSignature(message, symbol);
  
  const components: TypeScriptComponents = {
    code,
    symbol,
    message_sig
  };
  
  return completeFinding({
    file,
    line,
    column,
    tool: 'typescript',
    severity,
    components,
    message
  });
}

/**
 * Main adapter function: parse tsc output → stable findings
 */
export function adaptTypeScriptOutput(tscOutput: string): FindingIdentity[] {
  const rawDiagnostics = parseTSCOutput(tscOutput);
  return rawDiagnostics.map(convertToFinding);
}

/**
 * Filter findings by file pattern (for scoped checks)
 */
export function filterByPattern(
  findings: FindingIdentity[],
  pattern: RegExp
): FindingIdentity[] {
  return findings.filter(f => pattern.test(f.file));
}

/**
 * Group findings by file (for reporting)
 */
export function groupByFile(
  findings: FindingIdentity[]
): Map<string, FindingIdentity[]> {
  const groups = new Map<string, FindingIdentity[]>();
  
  for (const finding of findings) {
    const list = groups.get(finding.file) || [];
    list.push(finding);
    groups.set(finding.file, list);
  }
  
  return groups;
}

/**
 * Example usage:
 * 
 * ```typescript
 * import { adaptTypeScriptOutput } from './typescript-adapter';
 * import { execSync } from 'child_process';
 * 
 * // Run tsc and capture output
 * let tscOutput = '';
 * try {
 *   execSync('npx tsc --noEmit', { encoding: 'utf-8' });
 * } catch (error: any) {
 *   tscOutput = error.stderr || error.stdout || '';
 * }
 * 
 * // Convert to findings
 * const findings = adaptTypeScriptOutput(tscOutput);
 * 
 * // Filter to specific scope
 * const platformFindings = filterByPattern(findings, /^src\/platform\//);
 * 
 * console.log(`Found ${platformFindings.length} platform findings`);
 * ```
 */
