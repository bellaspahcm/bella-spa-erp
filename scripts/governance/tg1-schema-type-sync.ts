#!/usr/bin/env tsx
/**
 * TG-1 — Schema-Type Synchronization Gate
 * 
 * Enforces invariant: Generated database types must match canonical schema.
 * 
 * Mechanism: Generate fresh types deterministically, compare with committed types.
 * Result: PASS if synchronized, BLOCK if drift detected.
 * 
 * Does NOT auto-fix. Gate detects + blocks only.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface GateResult {
  pass: boolean;
  message: string;
  diff?: string;
}

/**
 * Generate fresh types from canonical Supabase schema
 */
async function generateFreshTypes(): Promise<string> {
  console.log('🔄 Generating fresh types from canonical schema...');
  
  try {
    // Generate types to temporary location
    const tempFile = path.join(process.cwd(), '.tmp-db-types.ts');
    
    // Suppress stderr (warnings about deprecated config, version updates)
    // Use PowerShell-compatible redirection
    const command = process.platform === 'win32'
      ? `npx supabase gen types typescript --linked 2>$null > "${tempFile}"`
      : `npx supabase gen types typescript --linked 2>/dev/null > "${tempFile}"`;
    
    execSync(command, {
      encoding: 'utf-8',
      shell: process.platform === 'win32' ? 'powershell.exe' : undefined
    });
    
    const content = fs.readFileSync(tempFile, 'utf-8');
    
    // Clean up temp file
    fs.unlinkSync(tempFile);
    
    return normalizeTypeContent(content);
  } catch (error) {
    throw new Error(`Failed to generate fresh types: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Read committed types from repository
 */
async function readCommittedTypes(): Promise<string> {
  const typesPath = path.join(process.cwd(), 'src/types/database.types.ts');
  
  if (!fs.existsSync(typesPath)) {
    throw new Error('Committed database.types.ts not found');
  }
  
  const content = fs.readFileSync(typesPath, 'utf-8');
  return normalizeTypeContent(content);
}

/**
 * Normalize type content for comparison
 * 
 * Strips:
 * - Line ending differences (CRLF vs LF)
 * - Trailing whitespace per line
 * - Multiple consecutive blank lines
 * - Final trailing newline (normalize to single \n)
 * 
 * Preserves:
 * - Actual type definitions
 * - Property order
 * - Comments (part of semantic content)
 */
function normalizeTypeContent(content: string): string {
  return content
    .replace(/\r\n/g, '\n')           // Normalize line endings to LF
    .replace(/[ \t]+$/gm, '')         // Remove trailing whitespace per line
    .replace(/\n{3,}/g, '\n\n')       // Normalize multiple blank lines to double
    .replace(/\n+$/, '\n')            // Normalize final newlines to single
    .trim() + '\n';                   // Ensure exactly one final newline
}

/**
 * Compare fresh types with committed types
 */
async function compareTypes(
  freshTypes: string,
  committedTypes: string
): Promise<{ identical: boolean; diff?: string }> {
  const identical = freshTypes === committedTypes;
  
  if (identical) {
    return { identical: true };
  }
  
  // Generate simple diff summary
  const freshLines = freshTypes.split('\n').length;
  const committedLines = committedTypes.split('\n').length;
  const lineDiff = freshLines - committedLines;
  
  const diff = `
Lines in fresh generation: ${freshLines}
Lines in committed types: ${committedLines}
Difference: ${lineDiff > 0 ? '+' : ''}${lineDiff} lines

Content hash (fresh): ${hashContent(freshTypes)}
Content hash (committed): ${hashContent(committedTypes)}
`;
  
  return { identical: false, diff };
}

/**
 * Simple content hash for comparison
 */
function hashContent(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Format BLOCK message
 */
function formatBlockMessage(diff?: string): string {
  return `
═══════════════════════════════════════════════════
TG-1 SCHEMA-TYPE SYNC GATE: BLOCK
═══════════════════════════════════════════════════

Generated database types do not match canonical schema.

${diff || 'Drift detected between fresh generation and committed types.'}

Required action:
1. Regenerate database types from canonical schema:
   $ supabase gen types typescript --linked 2>$null > src/types/database.types.ts
   
2. Review the changes to ensure they reflect intended schema evolution

3. Commit the resulting type changes

4. Rerun this gate

Do NOT proceed with stale database types.
═══════════════════════════════════════════════════
`;
}

/**
 * Run TG-1 Gate
 */
async function runTG1Gate(): Promise<GateResult> {
  console.log('🔒 TG-1 — Schema-Type Synchronization Gate');
  console.log('');
  
  try {
    const fresh = await generateFreshTypes();
    console.log('✅ Fresh types generated');
    
    const committed = await readCommittedTypes();
    console.log('✅ Committed types loaded');
    
    const comparison = await compareTypes(fresh, committed);
    
    if (comparison.identical) {
      const message = '✅ PASS: Schema and types synchronized';
      console.log('');
      console.log(message);
      return { pass: true, message };
    } else {
      const message = formatBlockMessage(comparison.diff);
      console.log('');
      console.error(message);
      return { pass: false, message, diff: comparison.diff };
    }
  } catch (error) {
    const message = `❌ GATE ERROR: ${error instanceof Error ? error.message : String(error)}`;
    console.error(message);
    return { pass: false, message };
  }
}

// Execute if run directly
if (require.main === module) {
  runTG1Gate().then((result) => {
    process.exit(result.pass ? 0 : 1);
  });
}

export { runTG1Gate, generateFreshTypes, compareTypes, normalizeTypeContent };
