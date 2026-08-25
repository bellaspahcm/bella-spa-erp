/**
 * G5: Destructive Change Detection
 * 
 * Detects operations that may cause data loss or service disruption:
 * - DROP TABLE/COLUMN
 * - ALTER COLUMN (type changes that may fail)
 * - TRUNCATE
 * - DELETE without WHERE
 * - Disable RLS
 * - Remove constraints
 * 
 * Requires explicit acknowledgment for destructive operations.
 */

import type { Migration, PreflightResult, ValidationFailure } from '../types';

export async function detectDestructiveChanges(
  migration: Migration,
  options?: { allowDestructive?: boolean }
): Promise<PreflightResult> {
  const failures: ValidationFailure[] = [];
  
  const sql = migration.sql.toUpperCase();
  const sqlLines = migration.sql.split('\n');
  
  // Destructive patterns
  const destructivePatterns = [
    {
      pattern: /DROP\s+TABLE/gi,
      severity: 'ERROR' as const,
      description: 'DROP TABLE detected',
      impact: 'Permanent data loss'
    },
    {
      pattern: /DROP\s+COLUMN/gi,
      severity: 'ERROR' as const,
      description: 'DROP COLUMN detected',
      impact: 'Permanent column data loss'
    },
    {
      pattern: /TRUNCATE/gi,
      severity: 'ERROR' as const,
      description: 'TRUNCATE detected',
      impact: 'All table data will be deleted'
    },
    {
      pattern: /DELETE\s+FROM\s+\w+\s*;/gi,
      severity: 'ERROR' as const,
      description: 'DELETE without WHERE clause detected',
      impact: 'All table data will be deleted'
    },
    {
      pattern: /ALTER\s+TABLE\s+\w+\s+DISABLE\s+ROW\s+LEVEL\s+SECURITY/gi,
      severity: 'ERROR' as const,
      description: 'RLS disable detected',
      impact: 'Tenant isolation compromised'
    },
    {
      pattern: /DROP\s+CONSTRAINT/gi,
      severity: 'WARNING' as const,
      description: 'DROP CONSTRAINT detected',
      impact: 'Data integrity constraint removed'
    },
    {
      pattern: /DROP\s+INDEX/gi,
      severity: 'WARNING' as const,
      description: 'DROP INDEX detected',
      impact: 'Query performance may degrade'
    },
    {
      pattern: /ALTER\s+COLUMN\s+\w+\s+TYPE/gi,
      severity: 'WARNING' as const,
      description: 'Column type change detected',
      impact: 'May fail if data cannot be converted'
    },
    {
      pattern: /DROP\s+FUNCTION/gi,
      severity: 'WARNING' as const,
      description: 'DROP FUNCTION detected',
      impact: 'Dependent code may break'
    },
    {
      pattern: /DROP\s+TRIGGER/gi,
      severity: 'WARNING' as const,
      description: 'DROP TRIGGER detected',
      impact: 'Automated behavior removed'
    }
  ];
  
  for (const { pattern, severity, description, impact } of destructivePatterns) {
    const matches = migration.sql.match(pattern);
    
    if (matches && matches.length > 0) {
      // Find line numbers for context
      const lineNumbers: number[] = [];
      sqlLines.forEach((line, idx) => {
        if (pattern.test(line)) {
          lineNumbers.push(idx + 1);
        }
      });
      
      failures.push({
        gate: 'G5_DESTRUCTIVE',
        reason: `${description} (${matches.length} occurrence${matches.length > 1 ? 's' : ''})\n` +
                `  Impact: ${impact}\n` +
                `  Lines: ${lineNumbers.join(', ')}\n` +
                `  Matches: ${matches.slice(0, 3).join(', ')}${matches.length > 3 ? '...' : ''}`,
        severity,
        recommendation: severity === 'ERROR'
          ? 'Destructive changes require explicit approval and recovery strategy'
          : 'Review impact carefully before proceeding'
      });
    }
  }
  
  // Check for data modification in Kernel tables (Registry-based detection)
  // Based on KERNEL_PROTECTION_POLICY.md (APPROVED)
  const { kernelRegistry, isFrozenContract, getKernelArtifact } = require('../kernel-registry');
  
  for (const artifact of kernelRegistry) {
    const table = artifact.table;
    
    const updatePattern = new RegExp(`UPDATE\\s+${table}`, 'gi');
    const deletePattern = new RegExp(`DELETE\\s+FROM\\s+${table}`, 'gi');
    const truncatePattern = new RegExp(`TRUNCATE\\s+${table}`, 'gi');
    const dropPattern = new RegExp(`DROP\\s+TABLE\\s+${table}`, 'gi');
    const alterPattern = new RegExp(`ALTER\\s+TABLE\\s+${table}`, 'gi');
    
    if (updatePattern.test(migration.sql) || 
        deletePattern.test(migration.sql) || 
        truncatePattern.test(migration.sql) ||
        dropPattern.test(migration.sql) ||
        alterPattern.test(migration.sql)) {
      
      // Determine severity based on lifecycle
      if (artifact.lifecycle === 'frozen') {
        failures.push({
          gate: 'G5_DESTRUCTIVE',
          reason: `KERNEL VIOLATION: Attempt to modify frozen Kernel table '${table}'.\n` +
                  `  Kernel: ${artifact.kernel}\n` +
                  `  Contract Version: ${artifact.contractVersion}\n` +
                  `  Lifecycle: ${artifact.lifecycle}\n` +
                  `  Frozen Date: ${artifact.frozenDate}\n` +
                  `  ${artifact.notes || ''}`,
          severity: 'ERROR',
          recommendation: artifact.kernel === 'logistics' && artifact.contractVersion === 'E7.1'
            ? 'E7.1 baseline is FROZEN. Submit Architecture Change Request (ACR) to modify frozen contracts.'
            : 'Frozen contract requires Architecture Change Request (ACR). Product Verticals MUST use Public Contracts.'
        });
      } else if (artifact.lifecycle === 'active') {
        // Active Kernel — check actor
        // For now, log warning (actor detection not fully implemented yet)
        failures.push({
          gate: 'G5_DESTRUCTIVE',
          reason: `KERNEL MODIFICATION: Table '${table}' is active Kernel artifact.\n` +
                  `  Kernel: ${artifact.kernel}\n` +
                  `  Contract Version: ${artifact.contractVersion}\n` +
                  `  If this is Product Vertical code: Use Public Contracts.\n` +
                  `  If this is Kernel Team code: Modification allowed.`,
          severity: 'WARNING',
          recommendation: 'Verify actor: Product Vertical MUST use contracts. Kernel Team can evolve active artifacts.'
        });
      }
    }
  }
  
  // If destructive changes found and not explicitly allowed
  const hasErrors = failures.some(f => f.severity === 'ERROR');
  
  if (hasErrors && !options?.allowDestructive) {
    failures.push({
      gate: 'G5_DESTRUCTIVE',
      reason: 'Destructive changes detected but not explicitly allowed',
      severity: 'ERROR',
      recommendation: 'Set allowDestructive: true if these changes are intentional and recovery strategy is documented'
    });
  }
  
  return {
    pass: !hasErrors || options?.allowDestructive === true,
    gate: 'G5_DESTRUCTIVE',
    failures,
    timestamp: new Date()
  };
}
