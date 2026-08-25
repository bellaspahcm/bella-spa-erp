/**
 * G10: Recovery Strategy Validation
 * 
 * Validates explicit recovery strategy for each migration:
 * - ROLLBACK: Clean transaction rollback
 * - COMPENSATING: Forward-fix with compensating migration
 * - RESTORE: Database restore from backup
 * - FORWARD_FIX: Manual intervention required
 * 
 * Every migration MUST declare recovery strategy.
 */

import type { Migration, PreflightResult, ValidationFailure, RecoveryStrategy } from '../types';

const VALID_STRATEGIES: RecoveryStrategy[] = [
  'ROLLBACK',
  'COMPENSATING',
  'RESTORE',
  'FORWARD_FIX'
];

export async function validateRecoveryStrategy(migration: Migration): Promise<PreflightResult> {
  const failures: ValidationFailure[] = [];
  
  // Check 1: Recovery strategy is declared
  if (!migration.recoveryStrategy) {
    failures.push({
      gate: 'G10_RECOVERY',
      reason: 'No recovery strategy declared for this migration',
      severity: 'ERROR',
      recommendation: 'Declare recovery strategy: ROLLBACK | COMPENSATING | RESTORE | FORWARD_FIX'
    });
    
    return {
      pass: false,
      gate: 'G10_RECOVERY',
      failures,
      timestamp: new Date()
    };
  }
  
  // Check 2: Recovery strategy is valid
  if (!VALID_STRATEGIES.includes(migration.recoveryStrategy)) {
    failures.push({
      gate: 'G10_RECOVERY',
      reason: `Invalid recovery strategy: '${migration.recoveryStrategy}'`,
      severity: 'ERROR',
      recommendation: `Use one of: ${VALID_STRATEGIES.join(', ')}`
    });
  }
  
  // Check 3: Strategy matches migration characteristics
  const sql = migration.sql.toUpperCase();
  
  // Destructive operations cannot be ROLLBACK
  const hasDestructive = /DROP\s+TABLE|TRUNCATE|DELETE\s+FROM/gi.test(migration.sql);
  if (hasDestructive && migration.recoveryStrategy === 'ROLLBACK') {
    failures.push({
      gate: 'G10_RECOVERY',
      reason: 'Destructive operations detected but recovery strategy is ROLLBACK.\n' +
              '  Destructive changes cannot be rolled back cleanly.',
      severity: 'ERROR',
      recommendation: 'Use COMPENSATING, RESTORE, or FORWARD_FIX for destructive operations'
    });
  }
  
  // DDL operations in Finance/Healthcare require RESTORE or COMPENSATING
  const affectsKernel = /hc_|inventory_|fin_/gi.test(migration.sql);
  if (affectsKernel && migration.recoveryStrategy === 'FORWARD_FIX') {
    failures.push({
      gate: 'G10_RECOVERY',
      reason: 'Kernel table modifications should not use FORWARD_FIX strategy.\n' +
              '  Kernel integrity requires automated recovery.',
      severity: 'WARNING',
      recommendation: 'Consider ROLLBACK or COMPENSATING for Kernel modifications'
    });
  }
  
  // Large data modifications require backup/restore
  const hasLargeDataMod = /UPDATE\s+\w+\s+SET|INSERT\s+INTO\s+\w+\s+SELECT/gi.test(migration.sql);
  if (hasLargeDataMod && migration.recoveryStrategy === 'ROLLBACK') {
    failures.push({
      gate: 'G10_RECOVERY',
      reason: 'Large data modifications detected.\n' +
              '  Transaction rollback may be slow or timeout.',
      severity: 'WARNING',
      recommendation: 'Consider COMPENSATING or RESTORE strategy for large data changes'
    });
  }
  
  // Check 4: Strategy-specific requirements
  switch (migration.recoveryStrategy) {
    case 'ROLLBACK':
      // Verify migration is wrapped in transaction
      if (!sql.includes('BEGIN') && !sql.includes('START TRANSACTION')) {
        failures.push({
          gate: 'G10_RECOVERY',
          reason: 'ROLLBACK strategy requires explicit transaction control',
          severity: 'WARNING',
          recommendation: 'Wrap migration in BEGIN...COMMIT block'
        });
      }
      break;
      
    case 'COMPENSATING':
      // Check if compensating migration exists
      // (This would require checking Git for matching down migration)
      failures.push({
        gate: 'G10_RECOVERY',
        reason: 'COMPENSATING strategy requires prepared rollback migration',
        severity: 'WARNING',
        recommendation: 'Ensure compensating migration is prepared and tested'
      });
      break;
      
    case 'RESTORE':
      // Verify backup exists
      failures.push({
        gate: 'G10_RECOVERY',
        reason: 'RESTORE strategy requires verified database backup',
        severity: 'WARNING',
        recommendation: 'Verify database backup exists and restoration procedure is tested'
      });
      break;
      
    case 'FORWARD_FIX':
      // Require documented procedure
      failures.push({
        gate: 'G10_RECOVERY',
        reason: 'FORWARD_FIX requires documented manual intervention procedure',
        severity: 'WARNING',
        recommendation: 'Document step-by-step recovery procedure before deployment'
      });
      break;
  }
  
  return {
    pass: failures.filter(f => f.severity === 'ERROR').length === 0,
    gate: 'G10_RECOVERY',
    failures,
    timestamp: new Date()
  };
}
